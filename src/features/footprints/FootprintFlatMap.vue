<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { FootprintGroup } from './footprint';
import { createChinaAdapter, createWorldAdapter, type FootprintMapAdapter } from './footprint-map';

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

const adapter: FootprintMapAdapter = props.source === 'china' ? createChinaAdapter() : createWorldAdapter();
const zoomMin = adapter.zoomMin;
const zoomMax = adapter.zoomMax;

const mapEl = ref<HTMLElement | null>(null);
const sliderEl = ref<HTMLElement | null>(null);
const currentZoom = ref(zoomMin);
const zoomReady = ref(false);
const dragging = ref(false);

const elementsByKey = new Map<string, HTMLElement>();

const activeFootprint = computed(() => props.footprints.find((f) => f.key === props.activeKey) ?? null);

const updateMarkerStyles = () => {
  for (const [key, element] of elementsByKey) {
    element.classList.toggle('is-active', key === props.activeKey);
    element.classList.toggle('is-hovered', key === props.hoveredKey);
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

const renderMarkers = () => {
  const nextKeys = new Set<string>();
  for (const footprint of props.footprints) {
    nextKeys.add(footprint.key);
    const element = elementsByKey.get(footprint.key) ?? createMarkerElement(footprint);
    adapter.placeMarker(footprint.key, footprint.lng, footprint.lat, element);
  }
  for (const key of [...elementsByKey.keys()]) {
    if (!nextKeys.has(key)) {
      adapter.removeMarker(key);
      elementsByKey.delete(key);
    }
  }
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
    },
  );
});

onBeforeUnmount(() => {
  adapter.destroy();
  elementsByKey.clear();
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
</style>
