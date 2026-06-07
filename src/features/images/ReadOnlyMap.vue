<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createChinaPickAdapter, createWorldPickAdapter, type PickMapAdapter } from '@/features/upload/pick-map';
import { type LngLat, type MapRegion } from '@/features/upload/map-coordinate';

const props = withDefaults(defineProps<{
  lat?: number | null;
  lng?: number | null;
  region?: string | null;
  label?: string | null;
  interactive?: boolean;
  admin?: boolean;
}>(), {
  lat: null,
  lng: null,
  region: null,
  label: null,
  interactive: false,
  admin: false,
});

const emit = defineEmits<{ pick: [coords: { lat: number; lng: number }] }>();

const mapEl = ref<HTMLElement | null>(null);
let adapter: PickMapAdapter | null = null;
let adapterRegion: MapRegion | null = null;

const getCoordinates = () => {
  if (props.lat === null || props.lng === null) return null;
  if (!Number.isFinite(props.lat) || !Number.isFinite(props.lng)) return null;
  return { lat: props.lat, lng: props.lng };
};

const getRegion = () => {
  if (props.region === 'china' || props.region === 'global') return props.region;
  return null;
};

const interactiveRegion = (): MapRegion => (props.region === 'global' ? 'global' : 'china');

const staticError = ref(false);

// 只读态用静态地图代理（命中 R2 缓存则零高德调用），完全不加载 JS SDK。
const staticMapUrl = computed(() => {
  const coordinates = getCoordinates();
  const region = getRegion();
  if (!coordinates || !region) return null;
  const basePath = props.admin ? '/api/admin/staticmap' : '/api/staticmap';
  return `${basePath}?lat=${coordinates.lat}&lng=${coordinates.lng}&region=${region}`;
});

const onStaticError = () => {
  staticError.value = true;
};

const currentStoredCoordinate = (): LngLat | null => {
  const coordinates = getCoordinates();
  return coordinates ? { lng: coordinates.lng, lat: coordinates.lat } : null;
};

const createAdapter = (): PickMapAdapter =>
  interactiveRegion() === 'global' ? createWorldPickAdapter() : createChinaPickAdapter();

const destroyMap = () => {
  adapter?.destroy();
  adapter = null;
  adapterRegion = null;
};

const syncMarker = (center = false) => {
  adapter?.setMarker(currentStoredCoordinate(), center);
};

const emitPick = (stored: LngLat) => {
  if (!props.interactive) return;
  emit('pick', { lat: stored.lat, lng: stored.lng });
};

const initMap = async () => {
  if (!props.interactive || !mapEl.value || adapter) return;
  const nextAdapter = createAdapter();
  const nextRegion = interactiveRegion();
  adapter = nextAdapter;
  adapterRegion = nextRegion;
  await nextAdapter.init(
    mapEl.value,
    () => {
      if (adapter !== nextAdapter) return;
      nextAdapter.setMarker(currentStoredCoordinate(), true);
    },
    emitPick,
  );
};

const remountMap = async () => {
  destroyMap();
  await initMap();
};

onMounted(() => {
  if (props.interactive) void initMap();
});

watch(
  () => [props.lat, props.lng],
  () => {
    staticError.value = false;
    syncMarker(true);
  },
);

watch(
  () => props.interactive,
  async (interactive) => {
    if (interactive) {
      await initMap();
      syncMarker(true);
    } else {
      destroyMap();
    }
  },
);

watch(
  () => props.region,
  async () => {
    staticError.value = false;
    if (!props.interactive) return;
    if (interactiveRegion() === adapterRegion) return;
    await remountMap();
  },
);

onBeforeUnmount(() => {
  destroyMap();
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

:deep(.map-location-pin) {
  --pin-color: rgb(255, 79, 216);
  --pin-glow: rgba(255, 79, 216, 0.48);
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
