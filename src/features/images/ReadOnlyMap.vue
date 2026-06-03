<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  mapLngLatFromStored,
  storedLngLatFromMap,
} from '@/features/upload/map-coordinate';
import { loadAmap } from '@/features/upload/amap';
import type { AMapClickEvent, AMapMap, AMapMarker, AMapNamespace } from '@/features/upload/amap';

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
let map: AMapMap | null = null;
let marker: AMapMarker | null = null;
let amap: AMapNamespace | null = null;

const createMarkerElement = () => {
  const el = document.createElement('span');
  el.className = 'readonly-map-marker map-location-pin';
  el.setAttribute('aria-hidden', 'true');
  const dot = document.createElement('span');
  dot.className = 'map-location-pin-dot';
  el.appendChild(dot);
  return el;
};

const getCoordinates = () => {
  if (props.lat === null || props.lng === null) return null;
  if (!Number.isFinite(props.lat) || !Number.isFinite(props.lng)) return null;
  return { lat: props.lat, lng: props.lng };
};

const staticError = ref(false);

// 只读态用静态地图代理（命中 R2 缓存则零高德调用），完全不加载 JS SDK。
const staticMapUrl = computed(() => {
  const coordinates = getCoordinates();
  if (!coordinates) return null;
  return `/api/staticmap?lat=${coordinates.lat}&lng=${coordinates.lng}`;
});

const onStaticError = () => {
  staticError.value = true;
};

const mapCenter = (): [number, number] => {
  const coordinates = getCoordinates();
  const mapCoordinate = coordinates ? mapLngLatFromStored(coordinates) : null;
  const defaultCenter = mapLngLatFromStored(DEFAULT_CENTER);
  return mapCoordinate
    ? [mapCoordinate.lng, mapCoordinate.lat]
    : [defaultCenter.lng, defaultCenter.lat];
};

const placeMarker = () => {
  if (!map || !amap) return;
  const coordinates = getCoordinates();
  marker?.setMap(null);
  marker = null;
  map.setCenter(mapCenter());
  if (!coordinates) return;
  const mapCoordinate = mapLngLatFromStored(coordinates);
  marker = new amap.Marker({
    position: [mapCoordinate.lng, mapCoordinate.lat],
    content: createMarkerElement(),
    anchor: 'bottom-center',
  });
  marker.setMap(map);
};

const setInteractionState = (enabled: boolean) => {
  if (!map) return;
  map.setStatus?.({
    dragEnable: enabled,
    zoomEnable: enabled,
    doubleClickZoom: enabled,
    keyboardEnable: enabled,
  });
};

const handleMapClick = (event: AMapClickEvent) => {
  if (!props.interactive) return;
  const storedCoordinate = storedLngLatFromMap({
    lng: event.lnglat.getLng(),
    lat: event.lnglat.getLat(),
  });
  emit('pick', {
    lat: Number(storedCoordinate.lat.toFixed(6)),
    lng: Number(storedCoordinate.lng.toFixed(6)),
  });
};

const initMap = async () => {
  if (!mapEl.value || map) return;
  amap = await loadAmap();
  if (!mapEl.value || map) return;
  map = new amap.Map(mapEl.value, {
    center: mapCenter(),
    zoom: 10,
    lang: 'zh_cn',
    viewMode: '2D',
    dragEnable: props.interactive,
    zoomEnable: props.interactive,
    doubleClickZoom: props.interactive,
    keyboardEnable: props.interactive,
  });
  map.on('click', handleMapClick);
  setInteractionState(props.interactive);
  placeMarker();
};

onMounted(() => {
  if (props.interactive) void initMap();
});

watch(
  () => [props.lat, props.lng],
  () => {
    staticError.value = false;
    placeMarker();
  },
);

watch(
  () => props.interactive,
  async (interactive) => {
    if (interactive) {
      await initMap();
      setInteractionState(true);
    } else {
      setInteractionState(false);
    }
  },
);

onBeforeUnmount(() => {
  marker?.setMap(null);
  marker = null;
  map?.off('click', handleMapClick);
  map?.destroy();
  map = null;
  amap = null;
});
</script>

<template>
  <div
    class="readonly-map"
    :class="{ 'is-interactive': interactive, 'is-placeholder': !interactive && (!staticMapUrl || staticError) }"
    :aria-label="label || '图片位置地图'"
  >
    <div v-show="interactive" ref="mapEl" class="readonly-map-canvas" />
    <template v-if="!interactive">
      <img
        v-if="staticMapUrl && !staticError"
        class="readonly-map-static"
        :src="staticMapUrl"
        :alt="label || '图片位置地图'"
        loading="lazy"
        decoding="async"
        @error="onStaticError"
      />
      <div v-else class="readonly-map-placeholder">
        <span class="readonly-map-placeholder-icon" aria-hidden="true">📍</span>
        <span>暂无位置信息</span>
      </div>
    </template>
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

.readonly-map-static {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.readonly-map.is-placeholder {
  border-style: dashed;
  border-color: rgba(53, 243, 255, 0.22);
  background: rgba(7, 7, 19, 0.3);
}

.readonly-map-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  height: 100%;
  color: rgba(148, 163, 184, 0.75);
  font-size: 0.78rem;
}

.readonly-map-placeholder-icon {
  font-size: 1.5rem;
  opacity: 0.65;
}

:deep(.readonly-map-marker) {
  --pin-color: rgb(255, 79, 216);
  --pin-glow: rgba(255, 79, 216, 0.48);
}

:deep(.map-location-pin) {
  position: relative;
  display: block;
  width: 1.65rem;
  height: 2.15rem;
  filter: drop-shadow(0 0 12px var(--pin-glow));
}

:deep(.map-location-pin::before) {
  position: absolute;
  inset: 0.05rem 0.08rem 0.2rem;
  content: '';
  background: linear-gradient(145deg, rgb(255, 255, 255), var(--pin-color) 28%, rgb(159, 18, 120));
  border: 2px solid rgb(255, 255, 255);
  clip-path: polygon(50% 100%, 14% 50%, 14% 20%, 30% 4%, 70% 4%, 86% 20%, 86% 50%);
}

:deep(.map-location-pin-dot) {
  position: absolute;
  top: 0.48rem;
  left: 50%;
  width: 0.48rem;
  height: 0.48rem;
  border-radius: 50%;
  background: rgb(255, 255, 255);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.2);
  transform: translateX(-50%);
}

:deep(.amap-container) {
  outline: none;
}
</style>
