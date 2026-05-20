<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Map as MapLibreMap, MapMouseEvent, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_STYLE_URL, RASTER_FALLBACK_STYLE } from '@/features/upload/map-style';

const DEFAULT_CENTER = { lat: 31.2304, lng: 121.4737 };

const props = withDefaults(defineProps<{
  lat?: number | null;
  lng?: number | null;
  label?: string | null;
  interactive?: boolean;
}>(), {
  lat: null,
  lng: null,
  label: null,
  interactive: false,
});

const emit = defineEmits<{ pick: [coords: { lat: number; lng: number }] }>();

const mapEl = ref<HTMLElement | null>(null);
let map: MapLibreMap | null = null;
let marker: Marker | null = null;
let maplibre: typeof import('maplibre-gl') | null = null;

const createMarkerElement = () => {
  const el = document.createElement('span');
  el.className = 'readonly-map-marker';
  return el;
};

const getCoordinates = () => {
  if (props.lat === null || props.lng === null) return null;
  if (!Number.isFinite(props.lat) || !Number.isFinite(props.lng)) return null;
  return { lat: props.lat, lng: props.lng };
};

const mapCenter = (): [number, number] => {
  const coordinates = getCoordinates();
  return coordinates
    ? [coordinates.lng, coordinates.lat]
    : [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat];
};

const placeMarker = () => {
  if (!map || !maplibre) return;
  const coordinates = getCoordinates();
  marker?.remove();
  marker = null;
  map.setCenter(mapCenter());
  if (!coordinates) return;
  marker = new maplibre.Marker({ element: createMarkerElement(), anchor: 'center' })
    .setLngLat([coordinates.lng, coordinates.lat])
    .addTo(map);
};

const setInteractionState = (enabled: boolean) => {
  if (!map) return;
  const method = enabled ? 'enable' : 'disable';
  map.dragPan[method]();
  map.scrollZoom[method]();
  map.boxZoom[method]();
  map.dragRotate[method]();
  map.keyboard[method]();
  map.doubleClickZoom[method]();
  map.touchZoomRotate[method]();
};

const handleMapClick = (event: MapMouseEvent) => {
  if (!props.interactive) return;
  emit('pick', {
    lat: Number(event.lngLat.lat.toFixed(6)),
    lng: Number(event.lngLat.lng.toFixed(6)),
  });
};

const initMap = async () => {
  if (!mapEl.value || map) return;
  maplibre = await import('maplibre-gl');
  map = new maplibre.Map({
    container: mapEl.value,
    style: MAP_STYLE_URL,
    center: mapCenter(),
    zoom: 10,
    attributionControl: false,
    interactive: props.interactive,
  });
  map.on('click', handleMapClick);
  setInteractionState(props.interactive);
  map.once('error', () => {
    if (map) map.setStyle(RASTER_FALLBACK_STYLE);
  });
  map.once('load', placeMarker);
};

onMounted(() => {
  void initMap();
});

watch(
  () => [props.lat, props.lng],
  () => placeMarker(),
);

watch(
  () => props.interactive,
  (interactive) => setInteractionState(interactive),
);

onBeforeUnmount(() => {
  marker?.remove();
  marker = null;
  map?.off('click', handleMapClick);
  map?.remove();
  map = null;
  maplibre = null;
});
</script>

<template>
  <div class="readonly-map" :class="{ 'is-interactive': interactive }" :aria-label="label || '图片位置地图'">
    <div ref="mapEl" class="readonly-map-canvas" />
  </div>
</template>

<style scoped>
.readonly-map {
  overflow: hidden;
  height: 180px;
  border: 1px solid rgba(53, 243, 255, 0.18);
  border-radius: 6px;
  background: rgba(7, 7, 19, 0.65);
}

.readonly-map.is-interactive {
  cursor: crosshair;
}

.readonly-map-canvas {
  width: 100%;
  height: 100%;
}

:deep(.readonly-map-marker) {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: rgb(255, 79, 216);
  border: 2px solid rgb(255, 255, 255);
  box-shadow: 0 0 0 5px rgba(255, 79, 216, 0.25), 0 0 18px rgba(255, 79, 216, 0.8);
}

:deep(.maplibregl-canvas) {
  outline: none;
}
</style>
