<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { FootprintGroup } from './footprint';
import { createChinaAdapter, createWorldAdapter, type FootprintMapAdapter } from './footprint-map';
import {
  clusterProjectedMarkers,
  createSpiderfyOffsets,
  type FootprintMarkerCluster,
  type ProjectedFootprintMarker,
  type SpiderfyOffset,
} from './marker-clustering';

const props = defineProps<{
  footprints: FootprintGroup[];
  activeKey: string | null;
  hoveredKey: string | null;
  source: 'china' | 'world';
  emptyHint: string;
  mapLabel: string;
}>();

const emit = defineEmits<{ select: [footprint: FootprintGroup]; preview: [footprint: FootprintGroup | null] }>();

const TRACK_HEIGHT = 120;
const THUMB_SIZE = 13;
const CLUSTER_RADIUS = 44;
const CLUSTER_ZOOM_STEP = 2;
const SPIDERFY_RADIUS = 36;

const adapter: FootprintMapAdapter = props.source === 'china' ? createChinaAdapter() : createWorldAdapter();
const zoomMin = adapter.zoomMin;
const zoomMax = adapter.zoomMax;

const mapEl = ref<HTMLElement | null>(null);
const sliderEl = ref<HTMLElement | null>(null);
const currentZoom = ref(zoomMin);
const zoomReady = ref(false);
const dragging = ref(false);
const expandedClusterId = ref<string | null>(null);

const elementsByKey = new Map<string, HTMLElement>();
const clusterElementsById = new Map<string, HTMLElement>();
const clustersById = new Map<string, FootprintMarkerCluster>();
const mountedMarkerKeys = new Set<string>();

const activeFootprint = computed(() => props.footprints.find((f) => f.key === props.activeKey) ?? null);
const footprintsByKey = computed(() => new Map(props.footprints.map((footprint) => [footprint.key, footprint])));

const footprintMarkerKey = (key: string) => `footprint:${key}`;
const clusterMarkerKey = (id: string) => `cluster-marker:${id}`;

const formatMarkerCount = (count: number) => (count > 99 ? '99+' : String(count));

const restartMarkerAnimation = (element: HTMLElement, className: string) => {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
};

const updateMarkerStyles = () => {
  for (const [key, element] of elementsByKey) {
    element.classList.toggle('is-active', key === props.activeKey);
    element.classList.toggle('is-hovered', key === props.hoveredKey);
  }
  for (const [id, element] of clusterElementsById) {
    const cluster = clustersById.get(id);
    const hasActivePoint = cluster?.points.some((point) => point.key === props.activeKey) ?? false;
    const hasHoveredPoint = cluster?.points.some((point) => point.key === props.hoveredKey) ?? false;
    element.classList.toggle('is-active', hasActivePoint);
    element.classList.toggle('is-hovered', hasHoveredPoint);
  }
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

  marker.addEventListener('mouseenter', () => emit('preview', footprint));
  marker.addEventListener('mouseleave', () => emit('preview', null));
  marker.addEventListener('focus', () => emit('preview', footprint));
  marker.addEventListener('blur', () => emit('preview', null));
  marker.addEventListener('click', () => emit('select', footprint));

  elementsByKey.set(footprint.key, marker);
  return marker;
};

const openCluster = (cluster: FootprintMarkerCluster) => {
  if (adapter.getZoom() < zoomMax - 1) {
    expandedClusterId.value = null;
    adapter.focus(cluster.lng, cluster.lat, Math.min(zoomMax, adapter.getZoom() + CLUSTER_ZOOM_STEP));
    return;
  }

  expandedClusterId.value = expandedClusterId.value === cluster.id ? null : cluster.id;
  renderMarkers();
};

const createClusterElement = (clusterId: string) => {
  const marker = document.createElement('button');
  marker.type = 'button';
  marker.className = 'footprint-cluster-marker';

  const halo = document.createElement('span');
  halo.className = 'footprint-cluster-halo';
  marker.appendChild(halo);

  const count = document.createElement('span');
  count.className = 'footprint-cluster-count';
  marker.appendChild(count);

  const images = document.createElement('span');
  images.className = 'footprint-cluster-images';
  marker.appendChild(images);

  marker.addEventListener('click', () => {
    const cluster = clustersById.get(clusterId);
    if (cluster) openCluster(cluster);
  });

  clusterElementsById.set(clusterId, marker);
  return marker;
};

const updateClusterElement = (element: HTMLElement, cluster: FootprintMarkerCluster) => {
  const count = element.querySelector<HTMLElement>('.footprint-cluster-count');
  const images = element.querySelector<HTMLElement>('.footprint-cluster-images');
  if (count) count.textContent = formatMarkerCount(cluster.imagesCount);
  if (images) images.textContent = formatMarkerCount(cluster.points.length);
  element.setAttribute('aria-label', `${cluster.imagesCount} 张图片，${cluster.points.length} 个相近地点，点击放大或展开`);
};

const projectFootprints = (): ProjectedFootprintMarker[] => {
  const projected: ProjectedFootprintMarker[] = [];

  for (const footprint of props.footprints) {
    const point = adapter.project(footprint.lng, footprint.lat);
    if (!point) continue;
    projected.push({
      key: footprint.key,
      name: footprint.name,
      lng: footprint.lng,
      lat: footprint.lat,
      x: point.x,
      y: point.y,
      imagesCount: footprint.images.length,
    });
  }

  return projected;
};

const setMarkerOffset = (element: HTMLElement, offset: SpiderfyOffset | null) => {
  element.classList.toggle('is-spidered', Boolean(offset));
  element.style.setProperty('--marker-offset-x', `${offset?.x ?? 0}px`);
  element.style.setProperty('--marker-offset-y', `${offset?.y ?? 0}px`);
  if (offset) {
    restartMarkerAnimation(element, 'is-splitting');
  } else {
    element.classList.remove('is-splitting');
  }
};

const placeFootprintMarker = (
  footprint: FootprintGroup,
  lng: number,
  lat: number,
  nextMarkerKeys: Set<string>,
  offset: SpiderfyOffset | null = null,
) => {
  const key = footprintMarkerKey(footprint.key);
  const element = elementsByKey.get(footprint.key) ?? createMarkerElement(footprint);
  setMarkerOffset(element, offset);
  nextMarkerKeys.add(key);
  adapter.placeMarker(key, lng, lat, element);
};

const placeClusterMarker = (cluster: FootprintMarkerCluster, nextMarkerKeys: Set<string>) => {
  const key = clusterMarkerKey(cluster.id);
  const element = clusterElementsById.get(cluster.id) ?? createClusterElement(cluster.id);
  const wasMounted = mountedMarkerKeys.has(key);
  updateClusterElement(element, cluster);
  if (!wasMounted) restartMarkerAnimation(element, 'is-fusing');
  nextMarkerKeys.add(key);
  adapter.placeMarker(key, cluster.lng, cluster.lat, element);
};

const removeStaleMarkers = (nextMarkerKeys: Set<string>) => {
  for (const key of [...mountedMarkerKeys]) {
    if (nextMarkerKeys.has(key)) continue;
    adapter.removeMarker(key);
    mountedMarkerKeys.delete(key);
  }
  for (const key of nextMarkerKeys) mountedMarkerKeys.add(key);
};

const pruneCachedElements = (nextFootprintKeys: Set<string>, nextClusterIds: Set<string>) => {
  for (const key of [...elementsByKey.keys()]) {
    if (nextFootprintKeys.has(key)) continue;
    elementsByKey.delete(key);
  }
  for (const id of [...clusterElementsById.keys()]) {
    if (nextClusterIds.has(id)) continue;
    clusterElementsById.delete(id);
  }
};

const renderMarkers = () => {
  const nextMarkerKeys = new Set<string>();
  const nextFootprintKeys = new Set(props.footprints.map((footprint) => footprint.key));
  const nextClusterIds = new Set<string>();
  const projected = projectFootprints();

  clustersById.clear();

  if (projected.length !== props.footprints.length) {
    expandedClusterId.value = null;
    for (const footprint of props.footprints) {
      placeFootprintMarker(footprint, footprint.lng, footprint.lat, nextMarkerKeys);
    }
    removeStaleMarkers(nextMarkerKeys);
    pruneCachedElements(nextFootprintKeys, nextClusterIds);
    updateMarkerStyles();
    return;
  }

  const clusters = clusterProjectedMarkers(projected, { radius: CLUSTER_RADIUS });

  for (const cluster of clusters) {
    clustersById.set(cluster.id, cluster);
    if (cluster.kind === 'cluster') nextClusterIds.add(cluster.id);
  }

  if (expandedClusterId.value && !clustersById.has(expandedClusterId.value)) {
    expandedClusterId.value = null;
  }

  for (const cluster of clusters) {
    if (cluster.kind === 'single') {
      const point = cluster.points[0];
      const footprint = footprintsByKey.value.get(point.key);
      if (footprint) placeFootprintMarker(footprint, point.lng, point.lat, nextMarkerKeys);
      continue;
    }

    if (expandedClusterId.value === cluster.id) {
      const offsets = createSpiderfyOffsets(cluster.points.length, { radius: SPIDERFY_RADIUS });
      cluster.points.forEach((point, index) => {
        const footprint = footprintsByKey.value.get(point.key);
        if (footprint) placeFootprintMarker(footprint, cluster.lng, cluster.lat, nextMarkerKeys, offsets[index]);
      });
      continue;
    }

    placeClusterMarker(cluster, nextMarkerKeys);
  }

  removeStaleMarkers(nextMarkerKeys);
  pruneCachedElements(nextFootprintKeys, nextClusterIds);
  updateMarkerStyles();
};

const fitView = () => {
  if (activeFootprint.value) {
    adapter.focus(activeFootprint.value.lng, activeFootprint.value.lat);
    return;
  }
  adapter.fitAll(props.footprints.map((f) => ({ lng: f.lng, lat: f.lat })));
};

const thumbTop = computed(() => {
  const range = zoomMax - zoomMin;
  if (range <= 0) return 0;
  const ratio = (zoomMax - currentZoom.value) / range;
  return Math.max(0, Math.min(1, ratio)) * (TRACK_HEIGHT - THUMB_SIZE);
});

const applyZoom = (value: number) => {
  const clamped = Math.max(zoomMin, Math.min(zoomMax, value));
  adapter.setZoom(clamped);
  currentZoom.value = clamped;
};

const zoomBy = (delta: number) => applyZoom(adapter.getZoom() + delta);
const resetZoom = () => applyZoom(zoomMin);

const updateFromClientY = (clientY: number) => {
  if (!sliderEl.value) return;
  const rect = sliderEl.value.getBoundingClientRect();
  const usable = rect.height - THUMB_SIZE;
  if (usable <= 0) return;
  const raw = clientY - rect.top - THUMB_SIZE / 2;
  const clamped = Math.max(0, Math.min(usable, raw));
  const ratio = clamped / usable;
  applyZoom(zoomMax - ratio * (zoomMax - zoomMin));
};

const onSliderPointerDown = (event: PointerEvent) => {
  if (event.button !== 0 || !sliderEl.value) return;
  dragging.value = true;
  sliderEl.value.setPointerCapture(event.pointerId);
  updateFromClientY(event.clientY);
};

const onSliderPointerMove = (event: PointerEvent) => {
  if (dragging.value) updateFromClientY(event.clientY);
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
    applyZoom(zoomMax);
  } else if (event.key === 'End') {
    event.preventDefault();
    applyZoom(zoomMin);
  }
};

watch(
  () => props.footprints,
  () => {
    if (!zoomReady.value) return;
    expandedClusterId.value = null;
    renderMarkers();
    if (!activeFootprint.value) fitView();
  },
  { deep: true },
);

watch(
  () => [props.activeKey, props.hoveredKey],
  () => {
    if (!zoomReady.value) return;
    updateMarkerStyles();
    if (activeFootprint.value) adapter.focus(activeFootprint.value.lng, activeFootprint.value.lat);
  },
);

onMounted(() => {
  if (!mapEl.value) return;
  void adapter.init(
    mapEl.value,
    () => {
      zoomReady.value = true;
      currentZoom.value = adapter.getZoom();
      renderMarkers();
      fitView();
    },
    (zoom) => {
      currentZoom.value = zoom;
      if (!zoomReady.value) return;
      expandedClusterId.value = null;
      renderMarkers();
    },
  );
});

onBeforeUnmount(() => {
  adapter.destroy();
  elementsByKey.clear();
  clusterElementsById.clear();
  clustersById.clear();
  mountedMarkerKeys.clear();
});
</script>

<template>
  <div class="footprint-flat" :class="`is-${source}`">
    <div ref="mapEl" class="footprint-flat-map" :aria-label="mapLabel" />

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

    <div v-if="footprints.length === 0" class="footprint-flat-empty">{{ emptyHint }}</div>
  </div>
</template>

<style scoped>
.footprint-flat {
  position: absolute;
  inset: 0;
}

.footprint-flat-map {
  position: absolute;
  inset: 0;
}

:deep(.amap-container),
:deep(.maplibregl-map) {
  background: transparent;
  outline: none;
}

:deep(.maplibregl-ctrl-attrib) {
  background: rgba(7, 7, 19, 0.55);
  backdrop-filter: blur(6px);
}

:deep(.maplibregl-ctrl-attrib),
:deep(.maplibregl-ctrl-attrib a) {
  color: rgba(148, 163, 184, 0.82);
}

:deep(.maplibregl-ctrl-scale) {
  border-color: rgba(255, 255, 255, 0.24);
  background: rgba(7, 7, 19, 0.55);
  color: rgba(226, 232, 240, 0.82);
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
  transform: translate(var(--marker-offset-x, 0), var(--marker-offset-y, 0));
  transition: transform 180ms ease, filter 180ms ease;
  will-change: transform;
  z-index: 2;
}

:deep(.maplibregl-marker.footprint-marker) {
  transition: filter 180ms ease;
  will-change: auto;
}

:deep(.footprint-marker.is-spidered) {
  z-index: 8;
  filter: drop-shadow(0 0 10px rgba(53, 243, 255, 0.45));
}

:deep(.footprint-marker.is-splitting) {
  animation: spiderfy-split-in 220ms cubic-bezier(0.2, 0.9, 0.2, 1) both;
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

:deep(.footprint-cluster-marker) {
  position: relative;
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 1px solid rgba(53, 243, 255, 0.72);
  border-radius: 999px;
  background:
    radial-gradient(circle at 50% 44%, rgba(53, 243, 255, 0.28), rgba(53, 243, 255, 0.07) 56%, rgba(7, 7, 19, 0.76) 100%),
    rgba(7, 7, 19, 0.68);
  color: rgb(236, 254, 255);
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    0 0 0 4px rgba(53, 243, 255, 0.07),
    0 0 18px rgba(53, 243, 255, 0.34);
  transition: border-color 180ms ease, box-shadow 180ms ease, filter 180ms ease;
  z-index: 6;
}

:deep(.footprint-cluster-marker.is-fusing) {
  animation: cluster-fuse-in 240ms cubic-bezier(0.18, 0.9, 0.2, 1) both;
}

:deep(.footprint-cluster-marker:hover),
:deep(.footprint-cluster-marker:focus-visible) {
  border-color: rgba(125, 249, 255, 0.96);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.28),
    0 0 0 5px rgba(53, 243, 255, 0.1),
    0 0 22px rgba(53, 243, 255, 0.52);
  filter: saturate(1.15);
  outline: none;
}

:deep(.footprint-cluster-marker.is-active),
:deep(.footprint-cluster-marker.is-hovered) {
  border-color: rgba(255, 79, 216, 0.9);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.28),
    0 0 0 5px rgba(255, 79, 216, 0.11),
    0 0 24px rgba(255, 79, 216, 0.54);
}

:deep(.footprint-cluster-halo) {
  position: absolute;
  inset: -5px;
  border: 1px solid rgba(53, 243, 255, 0.2);
  border-radius: 999px;
  animation: cluster-breathe 2.8s ease-in-out infinite;
}

:deep(.footprint-cluster-count) {
  position: relative;
  z-index: 1;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.78rem;
  font-weight: 950;
  line-height: 1;
}

:deep(.footprint-cluster-images) {
  position: absolute;
  right: -0.2rem;
  bottom: -0.22rem;
  display: grid;
  min-width: 1.15rem;
  height: 0.9rem;
  place-items: center;
  border: 1px solid rgba(7, 7, 19, 0.72);
  border-radius: 999px;
  background: rgb(53, 243, 255);
  color: rgb(5, 5, 16);
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.5rem;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}

.footprint-flat-empty {
  position: absolute;
  left: 1rem;
  bottom: 1rem;
  z-index: 5;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 14px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.03) 50%, rgba(255, 255, 255, 0.08) 100%),
    rgba(7, 10, 24, 0.22);
  padding: 0.55rem 0.8rem;
  color: rgba(241, 245, 249, 0.94);
  font-size: 0.8rem;
  backdrop-filter: blur(22px) saturate(180%);
  -webkit-backdrop-filter: blur(22px) saturate(180%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 8px 24px rgba(0, 0, 0, 0.3);
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

@keyframes cluster-breathe {
  0%,
  100% {
    opacity: 0.45;
    transform: scale(0.92);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.08);
  }
}

@keyframes cluster-fuse-in {
  0% {
    opacity: 0;
    filter: blur(2px);
    transform: scale(0.58);
  }
  68% {
    opacity: 1;
    filter: blur(0);
    transform: scale(1.08);
  }
  100% {
    opacity: 1;
    filter: blur(0);
    transform: scale(1);
  }
}

@keyframes spiderfy-split-in {
  0% {
    opacity: 0.5;
    transform: translate(0, 0) scale(0.72);
  }
  68% {
    opacity: 1;
    transform: translate(var(--marker-offset-x, 0), var(--marker-offset-y, 0)) scale(1.08);
  }
  100% {
    opacity: 1;
    transform: translate(var(--marker-offset-x, 0), var(--marker-offset-y, 0)) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  :deep(.footprint-marker),
  :deep(.footprint-marker-ring),
  :deep(.footprint-marker.is-splitting),
  :deep(.footprint-cluster-marker),
  :deep(.footprint-cluster-marker.is-fusing),
  :deep(.footprint-cluster-halo),
  .zoom-slider,
  .zoom-btn,
  .zoom-thumb {
    animation: none;
    transition: none;
  }
}
</style>
