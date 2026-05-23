<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { GeoJSONSource, Map as MapLibreMap, Marker } from 'maplibre-gl';
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
const FOOTPRINT_SOURCE_ID = 'footprints-source';
const FOOTPRINT_HEATMAP_LAYER_ID = 'footprints-heatmap-layer';
const FOOTPRINT_POINT_LAYER_ID = 'footprints-point-layer';
const HEATMAP_FADE_START = 5;
const HEATMAP_FADE_END = 8;
const MARKER_FADE_IN = 6;
const MARKER_MIN_ZOOM = MARKER_FADE_IN - 0.5;

const flatMapEl = ref<HTMLElement | null>(null);
const loading = ref(false);
const loadError = ref<string | null>(null);
const images = ref<ImageRecord[]>([]);
const activeFootprintKey = ref<string | null>(null);
const hoveredFootprintKey = ref<string | null>(null);

let flatMap: MapLibreMap | null = null;
let maplibre: typeof import('maplibre-gl') | null = null;
let maplibrePromise: Promise<typeof import('maplibre-gl')> | null = null;
let markersByKey = new Map<string, Marker>();
let flatMarkerElements = new Map<string, HTMLElement>();
let sourceReady = false;

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

const loadMaplibre = async () => {
  maplibrePromise ??= import('maplibre-gl');
  maplibre = await maplibrePromise;
  return maplibre;
};

const clearAllMarkers = () => {
  for (const marker of markersByKey.values()) marker.remove();
  markersByKey = new Map();
  flatMarkerElements = new Map();
};

interface PointFeatureProps {
  footprintKey: string;
}

interface RenderedFeature {
  geometry: { coordinates: [number, number] };
  properties: PointFeatureProps;
}

const buildGeoJSON = () => ({
  type: 'FeatureCollection' as const,
  features: footprints.value.map((footprint) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [footprint.lng, footprint.lat] },
    properties: { footprintKey: footprint.key, weight: footprint.images.length },
  })),
});

const getFootprintSource = (): GeoJSONSource | null => {
  return (flatMap?.getSource(FOOTPRINT_SOURCE_ID) as GeoJSONSource | undefined) ?? null;
};

const closeFlatPopups = () => {
  for (const marker of markersByKey.values()) marker.getPopup()?.remove();
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

const resetFlatMapView = () => {
  activeFootprintKey.value = null;
  hoveredFootprintKey.value = null;
  closeFlatPopups();
  void nextTick(() => {
    flatMap?.resize();
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
  if (!flatMap || !maplibre || !sourceReady) return;

  const nextKeys = new Set<string>();

  if (flatMap.getZoom() >= MARKER_MIN_ZOOM) {
    const features = flatMap.querySourceFeatures(FOOTPRINT_SOURCE_ID) as unknown as RenderedFeature[];

    for (const feature of features) {
      const coordinates = feature.geometry.coordinates;
      const footprintKey = feature.properties.footprintKey;
      const key = `point_${footprintKey}`;

      if (nextKeys.has(key)) continue;
      nextKeys.add(key);

      if (markersByKey.has(key)) {
        markersByKey.get(key)!.setLngLat(coordinates);
        continue;
      }

      const footprint = footprints.value.find((fp) => fp.key === footprintKey);
      if (!footprint) continue;

      const element = createMarkerElement(footprint);
      const marker = new maplibre.Marker({ element, anchor: 'center' })
        .setLngLat(coordinates)
        .setPopup(
          new maplibre.Popup({ offset: 18, closeButton: false, className: 'footprint-map-popup' })
            .setDOMContent(createPopupNode(footprint)),
        )
        .addTo(flatMap);
      markersByKey.set(key, marker);
    }
  }

  for (const [key, marker] of markersByKey) {
    if (!nextKeys.has(key)) {
      marker.remove();
      markersByKey.delete(key);
      if (key.startsWith('point_')) {
        const footprintKey = key.slice('point_'.length);
        flatMarkerElements.delete(footprintKey);
      }
    }
  }

  updateMarkerStyles();
};

const ensureFootprintLayers = () => {
  if (!flatMap) return;
  if (flatMap.getSource(FOOTPRINT_SOURCE_ID)) return;

  flatMap.addSource(FOOTPRINT_SOURCE_ID, {
    type: 'geojson',
    data: buildGeoJSON(),
  });

  flatMap.addLayer({
    id: FOOTPRINT_HEATMAP_LAYER_ID,
    type: 'heatmap',
    source: FOOTPRINT_SOURCE_ID,
    maxzoom: HEATMAP_FADE_END + 0.5,
    paint: {
      'heatmap-weight': [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'weight'], 1],
        1, 0.4,
        20, 1,
      ],
      'heatmap-intensity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        0, 0.8,
        HEATMAP_FADE_END, 1.6,
      ],
      'heatmap-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        0, 14,
        4, 22,
        HEATMAP_FADE_END, 36,
      ],
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, 'rgba(7, 10, 24, 0)',
        0.2, 'rgba(53, 243, 255, 0.25)',
        0.4, 'rgba(53, 243, 255, 0.55)',
        0.6, 'rgba(124, 247, 212, 0.78)',
        0.8, 'rgba(255, 232, 156, 0.88)',
        1, 'rgba(255, 79, 216, 0.95)',
      ],
      'heatmap-opacity': [
        'interpolate',
        ['linear'],
        ['zoom'],
        HEATMAP_FADE_START, 0.95,
        HEATMAP_FADE_END, 0,
      ],
    },
  });

  flatMap.addLayer({
    id: FOOTPRINT_POINT_LAYER_ID,
    type: 'circle',
    source: FOOTPRINT_SOURCE_ID,
    paint: {
      'circle-radius': 1,
      'circle-opacity': 0,
    },
  });
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

  const onStyleReady = () => {
    if (!flatMap) return;
    ensureFootprintLayers();
    fitFlatMapToFootprints();
  };

  flatMap.once('error', () => {
    if (!flatMap) return;
    flatMap.setStyle(RASTER_FALLBACK_STYLE);
    flatMap.once('styledata', onStyleReady);
  });
  flatMap.once('load', onStyleReady);

  flatMap.on('sourcedata', (event) => {
    if (event.sourceId !== FOOTPRINT_SOURCE_ID || !event.isSourceLoaded) return;
    sourceReady = true;
    renderFlatMarkers();
  });
  flatMap.on('moveend', renderFlatMarkers);
  flatMap.on('zoomend', renderFlatMarkers);
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
      const source = getFootprintSource();
      if (!source) return;
      sourceReady = false;
      source.setData(buildGeoJSON());
      fitFlatMapToFootprints();
    });
  },
  { deep: true },
);

watch([activeFootprint, hoveredFootprint], () => {
  updateMarkerStyles();
  void nextTick(() => flatMap?.resize());
});

onMounted(() => {
  void initFlatMap();
  void loadFootprints();
});

onBeforeUnmount(() => {
  clearAllMarkers();
  flatMap?.remove();
  flatMap = null;
  maplibre = null;
  maplibrePromise = null;
  sourceReady = false;
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

:deep(.maplibregl-popup-content) {
  border: 0;
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
  border: 0;
  color: rgb(53, 243, 255);
  font-size: 0.74rem;
  font-weight: 800;
  outline: none;
  box-shadow: none;
  text-decoration: none;
}

:deep(.footprint-popup-body a:focus-visible) {
  outline: none;
  text-decoration: underline;
  text-underline-offset: 0.18rem;
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
