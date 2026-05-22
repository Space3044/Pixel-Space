<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import AppShell from '@/shared/ui/AppShell.vue';
import type { ImageRecord } from '@/features/images/image.types';
import { listImages } from '@/features/images/images.api';
import { MAP_STYLE_URL, RASTER_FALLBACK_STYLE } from '@/features/upload/map-style';
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

const DEFAULT_CENTER: [number, number] = [104.1954, 35.8617];
const FLAT_ZOOM = 3;
const FLAT_FOCUS_ZOOM = 8;

const flatMapEl = ref<HTMLElement | null>(null);
const loading = ref(false);
const loadError = ref<string | null>(null);
const images = ref<ImageRecord[]>([]);
const activeFootprintKey = ref<string | null>(null);
const hoveredFootprintKey = ref<string | null>(null);

let flatMap: MapLibreMap | null = null;
let maplibre: typeof import('maplibre-gl') | null = null;
let maplibrePromise: Promise<typeof import('maplibre-gl')> | null = null;
let flatMarkers: Marker[] = [];
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
  footprints.value.find((footprint) => footprint.key === activeFootprintKey.value) ?? footprints.value[0] ?? null,
);

const hoveredFootprint = computed(() =>
  footprints.value.find((footprint) => footprint.key === hoveredFootprintKey.value) ?? null,
);

const loadMaplibre = async () => {
  maplibrePromise ??= import('maplibre-gl');
  maplibre = await maplibrePromise;
  return maplibre;
};

const clearFlatMarkers = () => {
  for (const marker of flatMarkers) marker.remove();
  flatMarkers = [];
  flatMarkerElements = new Map<string, HTMLElement>();
};

const updateMarkerStyles = () => {
  for (const [key, element] of flatMarkerElements.entries()) {
    element.classList.toggle('is-active', key === activeFootprint.value?.key);
    element.classList.toggle('is-hovered', key === hoveredFootprint.value?.key);
  }
};

const focusFlatMapOn = (footprint: FootprintGroup, zoom = FLAT_FOCUS_ZOOM) => {
  if (!flatMap) return;
  flatMap.flyTo({
    center: [footprint.lng, footprint.lat],
    zoom: Math.max(flatMap.getZoom(), zoom),
    speed: 0.8,
  });
};

const previewFootprint = (footprint: FootprintGroup | null) => {
  hoveredFootprintKey.value = footprint?.key ?? null;
};

const selectFootprint = (footprint: FootprintGroup) => {
  activeFootprintKey.value = footprint.key;
  focusFlatMapOn(footprint);
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

const createPopupNode = (footprint: FootprintGroup) => {
  const root = document.createElement('article');
  root.className = 'footprint-popup';

  const image = document.createElement('img');
  image.src = footprint.cover.public_url;
  image.alt = footprint.cover.title || footprint.cover.original_filename || footprint.name;
  image.className = 'footprint-popup-image';
  root.appendChild(image);

  const body = document.createElement('div');
  body.className = 'footprint-popup-body';

  const title = document.createElement('strong');
  title.textContent = footprint.name;
  body.appendChild(title);

  const count = document.createElement('span');
  count.textContent = `${footprint.images.length} 张图片`;
  body.appendChild(count);

  const link = document.createElement('a');
  link.href = `/p/${encodeURIComponent(footprint.cover.key)}`;
  link.textContent = '查看图片';
  body.appendChild(link);

  root.appendChild(body);
  return root;
};

const fitFlatMapToFootprints = () => {
  if (!flatMap || !maplibre) return;

  if (footprints.value.length === 0) {
    flatMap.setCenter(DEFAULT_CENTER);
    flatMap.setZoom(FLAT_ZOOM);
    return;
  }

  if (footprints.value.length === 1) {
    focusFlatMapOn(footprints.value[0]);
    return;
  }

  const bounds = new maplibre.LngLatBounds();
  for (const footprint of footprints.value) {
    bounds.extend([footprint.lng, footprint.lat]);
  }
  flatMap.fitBounds(bounds, { padding: 90, maxZoom: 9, duration: 700 });
};

const renderFlatMarkers = () => {
  if (!flatMap || !maplibre) return;

  clearFlatMarkers();
  for (const footprint of footprints.value) {
    const marker = new maplibre.Marker({
      element: createMarkerElement(footprint),
      anchor: 'center',
    })
      .setLngLat([footprint.lng, footprint.lat])
      .setPopup(
        new maplibre.Popup({
          offset: 18,
          closeButton: false,
          className: 'footprint-map-popup',
        }).setDOMContent(createPopupNode(footprint)),
      )
      .addTo(flatMap);

    flatMarkers.push(marker);
  }

  updateMarkerStyles();
  fitFlatMapToFootprints();
};

const initFlatMap = async () => {
  if (!flatMapEl.value || flatMap) return;

  maplibre = await loadMaplibre();
  flatMap = new maplibre.Map({
    container: flatMapEl.value,
    style: MAP_STYLE_URL,
    center: DEFAULT_CENTER,
    zoom: FLAT_ZOOM,
    attributionControl: false,
  });

  flatMap.once('error', () => {
    if (!flatMap) return;
    flatMap.setStyle(RASTER_FALLBACK_STYLE);
    flatMap.once('styledata', renderFlatMarkers);
  });
  flatMap.once('load', renderFlatMarkers);
};

const loadFootprints = async () => {
  loading.value = true;
  loadError.value = null;

  try {
    images.value = await listImages();
    activeFootprintKey.value = footprints.value[0]?.key ?? null;
  } catch (error) {
    loadError.value = (error as Error).message;
  } finally {
    loading.value = false;
  }
};

watch(
  footprints,
  () => {
    void nextTick(renderFlatMarkers);
  },
  { deep: true },
);

watch([activeFootprint, hoveredFootprint], updateMarkerStyles);

onMounted(() => {
  void initFlatMap();
  void loadFootprints();
});

onBeforeUnmount(() => {
  clearFlatMarkers();
  flatMap?.remove();
  flatMap = null;
  maplibre = null;
  maplibrePromise = null;
});
</script>

<template>
  <AppShell fluid>
    <section class="footprint-page">
      <header class="footprint-hero cyber-panel">
        <div>
          <p class="eyebrow">Travel Footprint</p>
        </div>
        <div class="hero-stats" aria-label="旅行足迹统计">
          <div>
            <span>{{ footprints.length }}</span>
            <p>点亮地点</p>
          </div>
          <div>
            <span>{{ locatedImages.length }}</span>
            <p>定位图片</p>
          </div>
          <div>
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
          <div class="flat-layout">
            <div class="flat-map-wrap">
              <div ref="flatMapEl" class="flat-map" aria-label="旅行足迹平面地图" />
              <div v-if="!loading && !loadError && footprints.length === 0" class="map-empty">
                暂无带经纬度的图片。
              </div>
            </div>

            <aside class="footprint-side">
              <section class="side-card">
                <p class="section-label">当前点位</p>
                <template v-if="activeFootprint">
                  <img class="active-cover" :src="activeFootprint.cover.public_url" :alt="activeFootprint.cover.title" />
                  <h3>{{ activeFootprint.name }}</h3>
                  <p class="coordinate">{{ coordinateLabel(activeFootprint.lat, activeFootprint.lng) }}</p>
                </template>
                <p v-else class="side-copy">上传并标记位置后，这里会显示最近点亮的地点。</p>
              </section>

              <section class="side-card">
                <div class="list-heading">
                  <p class="section-label">已点亮</p>
                  <span>{{ footprints.length }} 个地点</span>
                </div>

                <div v-if="footprints.length" class="footprint-list">
                  <button
                    v-for="footprint in footprints"
                    :key="footprint.key"
                    type="button"
                    class="footprint-item"
                    :class="{ 'is-active': footprint.key === activeFootprint?.key }"
                    @click="selectFootprint(footprint)"
                    @mouseenter="previewFootprint(footprint)"
                    @mouseleave="previewFootprint(null)"
                  >
                    <img :src="footprint.cover.public_url" :alt="footprint.cover.title" />
                    <span>
                      <strong>{{ footprint.name }}</strong>
                      <small>{{ footprint.images.length }} 张图片 · {{ coordinateLabel(footprint.lat, footprint.lng) }}</small>
                    </span>
                  </button>
                </div>
                <p v-else class="side-copy">还没有可点亮的位置。</p>
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
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 1rem;
  padding: 1.1rem 1.25rem;
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
  display: grid;
  min-width: 24rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
}

.hero-stats div {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  background: rgba(7, 7, 19, 0.42);
  padding: 0.7rem;
}

.hero-stats span {
  color: white;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 1.2rem;
  font-weight: 900;
}

.hero-stats p {
  margin: 0.18rem 0 0;
  color: rgba(148, 163, 184, 0.86);
  font-size: 0.7rem;
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
  grid-template-columns: minmax(0, 1fr) 22rem;
  gap: 1rem;
  min-height: 38rem;
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

.map-empty {
  position: absolute;
  left: 1rem;
  bottom: 1rem;
  z-index: 5;
  border: 1px solid rgba(53, 243, 255, 0.18);
  border-radius: 4px;
  background: rgba(7, 7, 19, 0.72);
  padding: 0.6rem 0.75rem;
  color: rgba(226, 232, 240, 0.9);
  font-size: 0.82rem;
  backdrop-filter: blur(10px);
}

.footprint-side {
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

.active-cover {
  display: block;
  width: 100%;
  height: 9rem;
  margin-top: 0.75rem;
  border-radius: 4px;
  object-fit: cover;
}

.side-card h3 {
  margin: 0.7rem 0 0;
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

.footprint-list {
  display: grid;
  max-height: 20rem;
  gap: 0.55rem;
  overflow-y: auto;
  margin-top: 0.8rem;
  padding-right: 0.15rem;
}

.footprint-item {
  display: grid;
  width: 100%;
  grid-template-columns: 3rem minmax(0, 1fr);
  gap: 0.65rem;
  align-items: center;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  background: rgba(7, 7, 19, 0.38);
  padding: 0.5rem;
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.footprint-item:hover,
.footprint-item.is-active {
  border-color: rgba(53, 243, 255, 0.34);
  background: rgba(53, 243, 255, 0.08);
}

.footprint-item img {
  width: 3rem;
  height: 3rem;
  border-radius: 4px;
  object-fit: cover;
}

.footprint-item strong,
.footprint-item small {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.footprint-item strong {
  color: rgb(226, 232, 240);
  font-size: 0.82rem;
  font-weight: 850;
}

.footprint-item small {
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

:deep(.maplibregl-canvas) {
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
  width: 13px;
  height: 13px;
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

:deep(.maplibregl-popup-content) {
  border: 1px solid rgba(53, 243, 255, 0.18);
  border-radius: 6px;
  background: rgba(7, 7, 19, 0.9);
  padding: 0;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(14px);
}

:deep(.maplibregl-popup-tip) {
  border-top-color: rgba(7, 7, 19, 0.9);
}

:deep(.footprint-popup) {
  display: grid;
  grid-template-columns: 4.5rem 9rem;
  gap: 0.7rem;
  padding: 0.6rem;
}

:deep(.footprint-popup-image) {
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 4px;
  object-fit: cover;
}

:deep(.footprint-popup-body) {
  min-width: 0;
}

:deep(.footprint-popup-body strong),
:deep(.footprint-popup-body span),
:deep(.footprint-popup-body a) {
  display: block;
}

:deep(.footprint-popup-body strong) {
  overflow: hidden;
  color: white;
  font-size: 0.86rem;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.footprint-popup-body span) {
  margin-top: 0.35rem;
  color: rgba(148, 163, 184, 0.86);
  font-size: 0.74rem;
}

:deep(.footprint-popup-body a) {
  margin-top: 0.55rem;
  color: rgb(53, 243, 255);
  font-size: 0.74rem;
  font-weight: 800;
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
    align-items: stretch;
    flex-direction: column;
  }

  .hero-stats {
    min-width: 0;
  }

  .flat-layout {
    grid-template-columns: 1fr;
  }

  .footprint-list {
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
