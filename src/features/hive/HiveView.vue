<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppShell from '@/shared/ui/AppShell.vue';
import type { ImageRecord } from '@/features/images/image.types';
import { listImages } from '@/features/images/images.api';
import { loadAmap } from '@/features/upload/amap';
import type { AMapMap, AMapMarker, AMapNamespace } from '@/features/upload/amap';
import { mapLngLatFromStored } from '@/features/upload/map-coordinate';
import WorldBoundaryGlobe from './WorldBoundaryGlobe.vue';

interface LocatedImage extends ImageRecord {
  location_lat: number;
  location_lng: number;
}

interface FootprintGroup {
  key: string;
  name: string;
  lat: number;
  lng: number;
  cover: ImageRecord;
  images: ImageRecord[];
}

const mapPointFromStored = (lng: number, lat: number): [number, number] => {
  const coordinate = mapLngLatFromStored({ lng, lat });
  return [coordinate.lng, coordinate.lat];
};

const DEFAULT_CENTER_COORDINATE = mapLngLatFromStored({ lng: 104.1954, lat: 35.8617 });
const DEFAULT_CENTER: [number, number] = [DEFAULT_CENTER_COORDINATE.lng, DEFAULT_CENTER_COORDINATE.lat];
const FLAT_ZOOM = 3;
const FLAT_FOCUS_ZOOM = 12;
const ZOOM_MIN = 1;
const ZOOM_MAX = 18;
const TRACK_HEIGHT = 120;
const THUMB_SIZE = 13;

const flatMapEl = ref<HTMLElement | null>(null);
const sliderEl = ref<HTMLElement | null>(null);
const loading = ref(false);
const loadError = ref<string | null>(null);
const images = ref<ImageRecord[]>([]);
const activeFootprintKey = ref<string | null>(null);
const hoveredFootprintKey = ref<string | null>(null);
const currentZoom = ref(FLAT_ZOOM);
const zoomMin = ref(ZOOM_MIN);
const zoomMax = ref(ZOOM_MAX);
const zoomReady = ref(false);
const dragging = ref(false);

let flatMap: AMapMap | null = null;
let amap: AMapNamespace | null = null;
let markersByKey = new Map<string, AMapMarker>();
let flatMarkerElements = new Map<string, HTMLElement>();

const isLocatedImage = (image: ImageRecord): image is LocatedImage =>
  image.location_lat !== null && image.location_lng !== null
  && Number.isFinite(image.location_lat) && Number.isFinite(image.location_lng);

const coordinateLabel = (lat: number, lng: number) => `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

const locatedImages = computed(() => images.value.filter(isLocatedImage));
const unlocatedCount = computed(() => Math.max(0, images.value.length - locatedImages.value.length));

const footprints = computed(() => {
  const groups = new Map<string, FootprintGroup>();

  for (const image of locatedImages.value) {
    const name = image.location_name?.trim() || coordinateLabel(image.location_lat, image.location_lng);
    const key = `${name}|${image.location_lat.toFixed(4)}|${image.location_lng.toFixed(4)}`;
    let group = groups.get(key);

    if (!group) {
      group = {
        key,
        name,
        lat: image.location_lat,
        lng: image.location_lng,
        cover: image,
        images: [],
      };
      groups.set(key, group);
    }

    group.images.push(image);
    if (!group.cover.caption && image.caption) group.cover = image;
  }

  return [...groups.values()].sort((a, b) =>
    b.images.length - a.images.length || a.name.localeCompare(b.name, 'zh-CN'),
  );
});

const visitedPlaces = computed(() => {
  const names = footprints.value.map((footprint) => footprint.name.trim()).filter(Boolean);
  return [...new Set(names)];
});

const visitedCoordinates = computed(() =>
  footprints.value.map((footprint) => ({
    lat: footprint.lat,
    lng: footprint.lng,
  })),
);

const activeFootprint = computed(() =>
  footprints.value.find((footprint) => footprint.key === activeFootprintKey.value) ?? null,
);

const hoveredFootprint = computed(() =>
  footprints.value.find((footprint) => footprint.key === hoveredFootprintKey.value) ?? null,
);

const clearAllMarkers = () => {
  for (const marker of markersByKey.values()) marker.setMap(null);
  markersByKey = new Map();
  flatMarkerElements = new Map();
};

const updateMarkerStyles = () => {
  for (const [key, element] of flatMarkerElements.entries()) {
    element.classList.toggle('is-active', key === activeFootprint.value?.key);
    element.classList.toggle('is-hovered', key === hoveredFootprint.value?.key);
  }
};

const focusFlatMapOn = (footprint: FootprintGroup, zoom = FLAT_FOCUS_ZOOM) => {
  if (!flatMap) return;
  flatMap.setZoomAndCenter(Math.max(flatMap.getZoom(), zoom), mapPointFromStored(footprint.lng, footprint.lat));
  currentZoom.value = flatMap.getZoom();
};

const previewFootprint = (footprint: FootprintGroup | null) => {
  hoveredFootprintKey.value = footprint?.key ?? null;
};

const selectFootprint = (footprint: FootprintGroup) => {
  activeFootprintKey.value = footprint.key;
  focusFlatMapOn(footprint);
};

const resetFlatMapView = () => {
  activeFootprintKey.value = null;
  hoveredFootprintKey.value = null;
  void nextTick(() => {
    flatMap?.resize?.();
    fitFlatMapToFootprints();
  });
};

const createMarkerElement = (footprint: FootprintGroup) => {
  const marker = document.createElement('button');
  marker.type = 'button';
  marker.className = 'footprint-marker';
  marker.setAttribute('aria-label', `${footprint.name}，已点亮，${footprint.images.length} 张图片`);

  const ring = document.createElement('span');
  ring.className = 'footprint-marker-ring';
  marker.appendChild(ring);

  const core = document.createElement('span');
  core.className = 'footprint-marker-core';
  marker.appendChild(core);

  const count = document.createElement('span');
  count.className = 'footprint-marker-count';
  count.textContent = String(footprint.images.length);
  marker.appendChild(count);

  marker.addEventListener('mouseenter', () => previewFootprint(footprint));
  marker.addEventListener('mouseleave', () => previewFootprint(null));
  marker.addEventListener('focus', () => previewFootprint(footprint));
  marker.addEventListener('blur', () => previewFootprint(null));
  marker.addEventListener('click', () => selectFootprint(footprint));

  flatMarkerElements.set(footprint.key, marker);
  return marker;
};

const renderFlatMarkers = () => {
  if (!flatMap || !amap) return;

  const nextKeys = new Set<string>();

  for (const footprint of footprints.value) {
    const key = `point_${footprint.key}`;
    const position = mapPointFromStored(footprint.lng, footprint.lat);
    nextKeys.add(key);

    const existing = markersByKey.get(key);
    if (existing) {
      existing.setPosition(position);
      continue;
    }

    const marker = new amap.Marker({
      position,
      content: createMarkerElement(footprint),
      anchor: 'center',
    });
    marker.setMap(flatMap);
    markersByKey.set(key, marker);
  }

  for (const [key, marker] of markersByKey) {
    if (!nextKeys.has(key)) {
      marker.setMap(null);
      markersByKey.delete(key);
      flatMarkerElements.delete(key.slice('point_'.length));
    }
  }

  updateMarkerStyles();
};

const fitFlatMapToFootprints = () => {
  if (!flatMap) return;

  if (activeFootprint.value) {
    focusFlatMapOn(activeFootprint.value);
    return;
  }

  if (footprints.value.length === 0) {
    flatMap.setCenter(DEFAULT_CENTER);
    flatMap.setZoom(FLAT_ZOOM);
    currentZoom.value = FLAT_ZOOM;
    return;
  }

  renderFlatMarkers();

  if (footprints.value.length === 1) {
    focusFlatMapOn(footprints.value[0]);
    return;
  }

  flatMap.setFitView?.([...markersByKey.values()], false, [90, 90, 90, 90], 9);
  currentZoom.value = flatMap.getZoom();
};

const zoomBy = (delta: number) => {
  if (!flatMap) return;
  const next = Math.max(zoomMin.value, Math.min(zoomMax.value, flatMap.getZoom() + delta));
  flatMap.setZoom(next);
  currentZoom.value = next;
};

const resetZoom = () => {
  if (!flatMap) return;
  flatMap.setZoom(FLAT_ZOOM);
  currentZoom.value = FLAT_ZOOM;
};

const thumbTop = computed(() => {
  const range = zoomMax.value - zoomMin.value;
  if (range <= 0) return 0;
  const ratio = (zoomMax.value - currentZoom.value) / range;
  return Math.max(0, Math.min(1, ratio)) * (TRACK_HEIGHT - THUMB_SIZE);
});

const updateFromClientY = (clientY: number) => {
  if (!flatMap || !sliderEl.value) return;
  const rect = sliderEl.value.getBoundingClientRect();
  const usable = rect.height - THUMB_SIZE;
  if (usable <= 0) return;
  const raw = clientY - rect.top - THUMB_SIZE / 2;
  const clamped = Math.max(0, Math.min(usable, raw));
  const ratio = clamped / usable;
  const value = zoomMax.value - ratio * (zoomMax.value - zoomMin.value);
  flatMap.setZoom(value);
  currentZoom.value = value;
};

const onSliderPointerDown = (event: PointerEvent) => {
  if (event.button !== 0 || !sliderEl.value) return;
  dragging.value = true;
  sliderEl.value.setPointerCapture(event.pointerId);
  updateFromClientY(event.clientY);
};

const onSliderPointerMove = (event: PointerEvent) => {
  if (!dragging.value) return;
  updateFromClientY(event.clientY);
};

const onSliderPointerUp = (event: PointerEvent) => {
  if (!sliderEl.value) return;
  dragging.value = false;
  if (sliderEl.value.hasPointerCapture(event.pointerId)) {
    sliderEl.value.releasePointerCapture(event.pointerId);
  }
};

const onSliderKeyDown = (event: KeyboardEvent) => {
  const step = event.shiftKey ? 0.1 : 1;
  if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
    event.preventDefault();
    zoomBy(step);
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
    event.preventDefault();
    zoomBy(-step);
  } else if (event.key === 'PageUp') {
    event.preventDefault();
    zoomBy(2);
  } else if (event.key === 'PageDown') {
    event.preventDefault();
    zoomBy(-2);
  } else if (event.key === 'Home') {
    event.preventDefault();
    if (flatMap) flatMap.setZoom(zoomMax.value);
  } else if (event.key === 'End') {
    event.preventDefault();
    if (flatMap) flatMap.setZoom(zoomMin.value);
  }
  if (flatMap) currentZoom.value = flatMap.getZoom();
};

const initFlatMap = async () => {
  if (!flatMapEl.value || flatMap) return;

  amap = await loadAmap();
  if (!flatMapEl.value || flatMap) return;

  flatMap = new amap.Map(flatMapEl.value, {
    center: DEFAULT_CENTER,
    zoom: FLAT_ZOOM,
    lang: 'zh_cn',
    viewMode: '2D',
    resizeEnable: true,
    zooms: [ZOOM_MIN, ZOOM_MAX],
  });

  flatMap.addControl(new amap.Scale());
  currentZoom.value = flatMap.getZoom();
  zoomReady.value = true;
  flatMap.on('zoomend', () => {
    if (!flatMap) return;
    currentZoom.value = flatMap.getZoom();
    renderFlatMarkers();
  });
  flatMap.on('moveend', renderFlatMarkers);
  renderFlatMarkers();
  fitFlatMapToFootprints();
};

const loadFootprints = async () => {
  loading.value = true;
  loadError.value = null;

  try {
    images.value = await listImages();
    activeFootprintKey.value = null;
  } catch (error) {
    loadError.value = (error as Error).message;
  } finally {
    loading.value = false;
  }
};

watch(
  footprints,
  () => {
    void nextTick(() => {
      renderFlatMarkers();
      fitFlatMapToFootprints();
    });
  },
  { deep: true },
);

watch([activeFootprint, hoveredFootprint], () => {
  updateMarkerStyles();
  void nextTick(() => flatMap?.resize?.());
});

onMounted(() => {
  void initFlatMap();
  void loadFootprints();
});

onBeforeUnmount(() => {
  clearAllMarkers();
  flatMap?.destroy();
  flatMap = null;
  amap = null;
});
</script>

<template>
  <AppShell fluid>
    <section class="footprint-page">
      <header class="footprint-hero cyber-panel">
        <p class="eyebrow">Travel Footprint</p>
        <div class="hero-stats" aria-label="旅行足迹统计">
          <div class="hero-stat">
            <span>{{ footprints.length }}</span>
            <p>点亮地点</p>
          </div>
          <span class="hero-stat-divider" aria-hidden="true" />
          <div class="hero-stat">
            <span>{{ locatedImages.length }}</span>
            <p>定位图片</p>
          </div>
          <span class="hero-stat-divider" aria-hidden="true" />
          <div class="hero-stat">
            <span>{{ unlocatedCount }}</span>
            <p>未定位</p>
          </div>
        </div>
      </header>

      <div v-if="loading" class="page-state cyber-panel">
        正在加载旅行足迹…
      </div>
      <div v-else-if="loadError" class="page-state is-error cyber-panel">
        加载失败：{{ loadError }}
      </div>

      <div class="stacked-map-layout">
        <article class="flat-map-card cyber-panel" aria-label="旅行足迹平面地图">
          <div class="flat-layout" :class="{ 'has-selection': activeFootprint }">
            <div class="flat-map-wrap">
              <div ref="flatMapEl" class="flat-map" aria-label="旅行足迹平面地图" />
              <div
                v-if="zoomReady"
                class="zoom-slider"
                role="group"
                aria-label="地图缩放"
                title="双击恢复默认缩放"
                @dblclick="resetZoom"
              >
                <button type="button" class="zoom-btn" aria-label="放大" @click="zoomBy(1)">+</button>
                <div
                  ref="sliderEl"
                  class="zoom-track"
                  role="slider"
                  tabindex="0"
                  :aria-valuemin="zoomMin"
                  :aria-valuemax="zoomMax"
                  :aria-valuenow="Math.round(currentZoom * 10) / 10"
                  aria-label="缩放级别"
                  @pointerdown="onSliderPointerDown"
                  @pointermove="onSliderPointerMove"
                  @pointerup="onSliderPointerUp"
                  @keydown="onSliderKeyDown"
                >
                  <div class="zoom-track-line" aria-hidden="true" />
                  <div
                    class="zoom-thumb"
                    :class="{ 'is-dragging': dragging }"
                    :style="{ top: thumbTop + 'px' }"
                    aria-hidden="true"
                  />
                </div>
                <button type="button" class="zoom-btn" aria-label="缩小" @click="zoomBy(-1)">−</button>
              </div>
              <div v-if="!loading && !loadError && footprints.length === 0" class="map-empty">
                暂无带经纬度的图片。
              </div>
            </div>

            <aside v-if="activeFootprint" class="footprint-side">
              <button
                type="button"
                class="map-overview-button"
                @click="resetFlatMapView"
              >
                返回总览
              </button>
              <section class="side-card">
                <p class="section-label">当前点位</p>
                <div class="active-point">
                  <img class="active-cover" :src="activeFootprint.cover.public_url" :alt="activeFootprint.cover.title" />
                  <div class="active-point-body">
                    <h3>{{ activeFootprint.name }}</h3>
                    <p class="coordinate">{{ coordinateLabel(activeFootprint.lat, activeFootprint.lng) }}</p>
                    <p class="side-copy">{{ activeFootprint.images.length }} 张图片</p>
                  </div>
                </div>
              </section>

              <section class="side-card">
                <div class="list-heading">
                  <p class="section-label">点位图片</p>
                  <span>{{ activeFootprint.images.length }} 张图片</span>
                </div>

                <div class="point-image-list">
                  <a
                    v-for="pointImage in activeFootprint.images"
                    :key="pointImage.key"
                    class="point-image-item"
                    :href="`/p/${encodeURIComponent(pointImage.key)}`"
                  >
                    <img :src="pointImage.public_url" :alt="pointImage.title" />
                    <span>
                      <strong>{{ pointImage.title || pointImage.original_filename }}</strong>
                      <small>{{ pointImage.width }} × {{ pointImage.height }} · {{ pointImage.format.toUpperCase() }}</small>
                    </span>
                  </a>
                </div>
              </section>
            </aside>
          </div>
        </article>

        <article class="globe-boundary-card cyber-panel" aria-label="边界地球模型">
          <WorldBoundaryGlobe :visited-places="visitedPlaces" :visited-coordinates="visitedCoordinates" />
        </article>
      </div>
    </section>
  </AppShell>
</template>

<style scoped>
.footprint-page {
  width: min(100%, 1600px);
  min-height: calc(100svh - 4rem);
  margin: 0 auto;
  padding: 0 1rem 2rem;
}

.footprint-hero,
.flat-map-card,
.globe-boundary-card,
.page-state {
  border-radius: 6px;
}

.footprint-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.85rem;
  padding: 0.55rem 1rem;
  min-height: 0;
}

.eyebrow,
.section-label {
  margin: 0;
  color: rgb(53, 243, 255);
  font-size: 0.7rem;
  font-weight: 850;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.hero-stats {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
}

.hero-stat {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  padding: 0;
  background: transparent;
  border: 0;
}

.hero-stat span {
  color: white;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 1rem;
  font-weight: 900;
  line-height: 1;
}

.hero-stat p {
  margin: 0;
  color: rgba(148, 163, 184, 0.86);
  font-size: 0.7rem;
  white-space: nowrap;
}

.hero-stat-divider {
  width: 1px;
  height: 0.85rem;
  background: rgba(255, 255, 255, 0.12);
}

.page-state {
  margin-bottom: 1rem;
  padding: 0.7rem 0.85rem;
  color: rgba(226, 232, 240, 0.9);
  font-size: 0.82rem;
}

.page-state.is-error {
  border-color: rgba(251, 113, 133, 0.36);
  color: rgb(253, 164, 175);
}

.stacked-map-layout {
  display: grid;
  gap: 1rem;
}

.flat-map-card,
.globe-boundary-card {
  position: relative;
  overflow: hidden;
  padding: 1rem;
}

.flat-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  min-height: 38rem;
}

.flat-layout.has-selection {
  grid-template-columns: minmax(0, 1fr) minmax(28rem, 34rem);
}

.flat-map-wrap {
  position: relative;
  min-height: 38rem;
  overflow: hidden;
  border: 1px solid rgba(53, 243, 255, 0.14);
  border-radius: 4px;
  background: rgba(7, 7, 19, 0.5);
}

.flat-map {
  position: absolute;
  inset: 0;
}

.map-overview-button {
  justify-self: end;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  background:
    linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.16) 0%,
      rgba(255, 255, 255, 0.04) 45%,
      rgba(255, 255, 255, 0.1) 100%
    ),
    rgba(7, 10, 24, 0.32);
  padding: 0.32rem 0.78rem;
  color: rgb(241, 245, 249);
  cursor: pointer;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  backdrop-filter: blur(18px) saturate(170%);
  -webkit-backdrop-filter: blur(18px) saturate(170%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.24),
    inset 0 -1px 0 rgba(255, 255, 255, 0.05),
    0 6px 18px rgba(0, 0, 0, 0.28);
  transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}

.map-overview-button:hover,
.map-overview-button:focus-visible {
  border-color: rgba(53, 243, 255, 0.5);
  background:
    linear-gradient(
      135deg,
      rgba(53, 243, 255, 0.22) 0%,
      rgba(255, 255, 255, 0.08) 50%,
      rgba(53, 243, 255, 0.14) 100%
    ),
    rgba(7, 10, 24, 0.32);
  color: white;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    inset 0 -1px 0 rgba(53, 243, 255, 0.12),
    0 8px 22px rgba(53, 243, 255, 0.26);
  outline: none;
}

.map-empty {
  position: absolute;
  left: 1rem;
  bottom: 1rem;
  z-index: 5;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 14px;
  background:
    linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.12) 0%,
      rgba(255, 255, 255, 0.03) 50%,
      rgba(255, 255, 255, 0.08) 100%
    ),
    rgba(7, 10, 24, 0.22);
  padding: 0.6rem 0.85rem;
  color: rgba(241, 245, 249, 0.94);
  font-size: 0.82rem;
  backdrop-filter: blur(22px) saturate(180%);
  -webkit-backdrop-filter: blur(22px) saturate(180%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    0 8px 24px rgba(0, 0, 0, 0.3);
}

.footprint-side {
  position: relative;
  display: grid;
  gap: 1rem;
  align-content: start;
  min-width: 0;
}

.side-card {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  background: rgba(7, 7, 19, 0.34);
  padding: 0.9rem;
}

.active-point {
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr);
  gap: 0.85rem;
  align-items: center;
  margin-top: 0.75rem;
}

.active-cover {
  display: block;
  width: 5.5rem;
  height: 5.5rem;
  margin-top: 0.75rem;
  border-radius: 4px;
  object-fit: cover;
}

.active-point .active-cover {
  margin-top: 0;
}

.active-point-body {
  min-width: 0;
}

.side-card h3 {
  margin: 0;
  overflow: hidden;
  color: white;
  font-size: 1rem;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.coordinate {
  margin: 0.32rem 0 0;
  color: rgb(53, 243, 255);
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.72rem;
}

.side-copy {
  margin: 0.6rem 0 0;
  color: rgba(203, 213, 225, 0.78);
  font-size: 0.82rem;
  line-height: 1.6;
}

.list-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.list-heading span {
  color: rgba(148, 163, 184, 0.82);
  font-size: 0.74rem;
}

.point-image-list {
  display: grid;
  max-height: 20rem;
  gap: 0.55rem;
  overflow-y: auto;
  margin-top: 0.8rem;
  padding-right: 0.15rem;
}

.point-image-item {
  display: grid;
  width: 100%;
  grid-template-columns: 4rem minmax(0, 1fr);
  gap: 0.65rem;
  align-items: center;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  background: rgba(7, 7, 19, 0.38);
  padding: 0.5rem;
  color: inherit;
  text-align: left;
  text-decoration: none;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.point-image-item:hover {
  border-color: rgba(53, 243, 255, 0.34);
  background: rgba(53, 243, 255, 0.08);
}

.point-image-item img {
  width: 4rem;
  height: 4rem;
  border-radius: 4px;
  object-fit: cover;
}

.point-image-item strong,
.point-image-item small {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.point-image-item strong {
  color: rgb(226, 232, 240);
  font-size: 0.82rem;
  font-weight: 850;
}

.point-image-item small {
  margin-top: 0.22rem;
  color: rgba(148, 163, 184, 0.82);
  font-size: 0.7rem;
}

.globe-boundary-card {
  min-height: 42rem;
  background:
    radial-gradient(circle at 50% 48%, rgba(53, 243, 255, 0.12), transparent 25rem),
    linear-gradient(180deg, rgba(8, 13, 26, 0.72), rgba(3, 7, 18, 0.88));
}

.globe-boundary-card::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(53, 243, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(53, 243, 255, 0.035) 1px, transparent 1px);
  background-size: 42px 42px;
  mask-image: radial-gradient(circle at 50% 52%, black, transparent 72%);
}

:deep(.amap-container) {
  background: transparent;
  outline: none;
}

:deep(.footprint-marker) {
  position: relative;
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
}

:deep(.footprint-marker-ring) {
  position: absolute;
  inset: 3px;
  border: 1px solid rgba(53, 243, 255, 0.72);
  border-radius: 999px;
  box-shadow: 0 0 14px rgba(53, 243, 255, 0.44);
  animation: marker-pulse 2.4s ease-out infinite;
}

:deep(.footprint-marker-core) {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 13px;
  height: 13px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: rgb(53, 243, 255);
  box-shadow: 0 0 0 5px rgba(53, 243, 255, 0.16), 0 0 20px rgba(53, 243, 255, 0.72);
}

:deep(.footprint-marker-count) {
  position: relative;
  z-index: 1;
  color: rgb(5, 5, 16);
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.62rem;
  font-weight: 900;
}

:deep(.footprint-marker.is-active .footprint-marker-core),
:deep(.footprint-marker.is-hovered .footprint-marker-core) {
  background: rgb(255, 79, 216);
  box-shadow: 0 0 0 6px rgba(255, 79, 216, 0.18), 0 0 24px rgba(255, 79, 216, 0.82);
}

:deep(.footprint-marker.is-active .footprint-marker-ring),
:deep(.footprint-marker.is-hovered .footprint-marker-ring) {
  border-color: rgba(255, 79, 216, 0.82);
  box-shadow: 0 0 18px rgba(255, 79, 216, 0.5);
}

.zoom-slider {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 6px 4px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  background: rgba(7, 7, 19, 0.42);
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 14px rgba(2, 4, 14, 0.28);
  opacity: 0.55;
  transition: opacity 180ms ease, background-color 180ms ease, border-color 180ms ease;
  user-select: none;
}

.zoom-slider:hover,
.zoom-slider:focus-within {
  opacity: 1;
  background: rgba(7, 7, 19, 0.7);
  border-color: rgba(255, 255, 255, 0.12);
}

.zoom-btn {
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: rgba(226, 232, 240, 0.7);
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background-color 140ms ease, color 140ms ease, transform 140ms ease;
}

.zoom-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgb(248, 250, 252);
}

.zoom-btn:active {
  transform: scale(0.92);
}

.zoom-track {
  position: relative;
  width: 22px;
  height: 120px;
  cursor: pointer;
  outline: none;
  touch-action: none;
}

.zoom-track:focus-visible {
  outline: none;
}

.zoom-track:focus-visible .zoom-thumb {
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5), 0 0 0 3px rgba(53, 243, 255, 0.35);
}

.zoom-track-line {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 3px;
  margin-left: -1.5px;
  background: rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  pointer-events: none;
}

.zoom-thumb {
  position: absolute;
  left: 50%;
  width: 13px;
  height: 13px;
  margin-left: -6.5px;
  border-radius: 50%;
  background: rgb(248, 250, 252);
  border: 1.5px solid rgba(7, 7, 19, 0.7);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.4);
  pointer-events: none;
  transition: box-shadow 140ms ease, transform 140ms ease;
  will-change: top;
}

.zoom-track:hover .zoom-thumb {
  transform: scale(1.08);
}

.zoom-thumb.is-dragging {
  transform: scale(1.2);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5), 0 0 0 4px rgba(53, 243, 255, 0.22);
}

@keyframes marker-pulse {
  0% {
    opacity: 0.9;
    transform: scale(0.72);
  }
  100% {
    opacity: 0;
    transform: scale(1.45);
  }
}

@media (max-width: 1024px) {
  .footprint-hero {
    flex-wrap: wrap;
    row-gap: 0.5rem;
  }

  .hero-stats {
    min-width: 0;
    gap: 0.65rem;
  }

  .flat-layout {
    grid-template-columns: 1fr;
  }

  .flat-layout.has-selection {
    grid-template-columns: 1fr;
  }

  .point-image-list {
    max-height: none;
  }
}

@media (max-width: 640px) {
  .footprint-page {
    padding-right: 0.75rem;
    padding-left: 0.75rem;
  }

  .hero-stats {
    grid-template-columns: 1fr;
  }

  .flat-layout,
  .flat-map-wrap {
    min-height: 24rem;
  }
}
</style>
