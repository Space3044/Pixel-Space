<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppShell from '@/shared/ui/AppShell.vue';
import LoadingState from '@/shared/ui/LoadingState.vue';
import type { ImageRecord } from '@/features/images/image.types';
import { listImages } from '@/features/images/images.api';
import { groupFootprints, type FootprintGroup } from './footprint';
import FootprintFlatMap from './FootprintFlatMap.vue';
import WorldBoundaryGlobe from './WorldBoundaryGlobe.vue';

const loading = ref(false);
const loadError = ref<string | null>(null);
const images = ref<ImageRecord[]>([]);
const activeFootprintKey = ref<string | null>(null);
const hoveredFootprintKey = ref<string | null>(null);

const coordinateLabel = (lat: number, lng: number) => `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

const footprints = computed(() => groupFootprints(images.value));
const domesticFootprints = computed(() => footprints.value.filter((footprint) => footprint.region === 'china'));
const overseasFootprints = computed(() => footprints.value.filter((footprint) => footprint.region === 'global'));

const locatedCount = computed(() => footprints.value.reduce((sum, footprint) => sum + footprint.images.length, 0));
const unlocatedCount = computed(() => Math.max(0, images.value.length - locatedCount.value));

const activeFootprint = computed(() =>
  footprints.value.find((footprint) => footprint.key === activeFootprintKey.value) ?? null,
);

const visitedPlaces = computed(() => {
  const names = footprints.value.map((footprint) => footprint.name.trim()).filter(Boolean);
  return [...new Set(names)];
});

const visitedCoordinates = computed(() =>
  footprints.value.map((footprint) => ({ lat: footprint.lat, lng: footprint.lng })),
);

const selectFootprint = (footprint: FootprintGroup) => {
  activeFootprintKey.value = footprint.key;
};

const previewFootprint = (footprint: FootprintGroup | null) => {
  hoveredFootprintKey.value = footprint?.key ?? null;
};

const resetSelection = () => {
  activeFootprintKey.value = null;
  hoveredFootprintKey.value = null;
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

onMounted(() => {
  void loadFootprints();
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
            <span>{{ locatedCount }}</span>
            <p>定位图片</p>
          </div>
          <span class="hero-stat-divider" aria-hidden="true" />
          <div class="hero-stat">
            <span>{{ unlocatedCount }}</span>
            <p>未定位</p>
          </div>
        </div>
      </header>

      <LoadingState v-if="loading" title="正在加载旅行足迹" message="同步足迹地图数据" />
      <LoadingState v-else-if="loadError" title="旅行足迹加载失败" :error="loadError" />

      <div class="stacked-map-layout">
        <div class="dual-map-grid">
          <article class="map-card cyber-panel" aria-label="国内足迹（高德底图）">
            <header class="map-card-head">
              <span class="map-card-title">国内足迹</span>
              <span class="map-card-count">{{ domesticFootprints.length }} 个点位 · 高德</span>
            </header>
            <div class="map-card-body">
              <FootprintFlatMap
                source="china"
                map-label="国内旅行足迹平面地图"
                empty-hint="暂无国内点位。"
                :footprints="domesticFootprints"
                :active-key="activeFootprintKey"
                :hovered-key="hoveredFootprintKey"
                @select="selectFootprint"
                @preview="previewFootprint"
              />
            </div>
          </article>

          <article class="map-card cyber-panel" aria-label="世界足迹（Mapbox 底图）">
            <header class="map-card-head">
              <span class="map-card-title">世界足迹</span>
              <span class="map-card-count">{{ overseasFootprints.length }} 个点位 · Mapbox</span>
            </header>
            <div class="map-card-body">
              <FootprintFlatMap
                source="world"
                map-label="世界旅行足迹平面地图"
                empty-hint="暂无国外点位。"
                :footprints="overseasFootprints"
                :active-key="activeFootprintKey"
                :hovered-key="hoveredFootprintKey"
                @select="selectFootprint"
                @preview="previewFootprint"
              />
            </div>
          </article>
        </div>

        <article v-if="activeFootprint" class="footprint-detail-card cyber-panel">
          <div class="detail-head">
            <p class="section-label">当前点位</p>
            <button type="button" class="map-overview-button" @click="resetSelection">返回总览</button>
          </div>

          <div class="active-point">
            <img class="active-cover" :src="activeFootprint.cover.public_url" :alt="activeFootprint.cover.title" />
            <div class="active-point-body">
              <h3>{{ activeFootprint.name }}</h3>
              <p class="coordinate">{{ coordinateLabel(activeFootprint.lat, activeFootprint.lng) }}</p>
              <p class="side-copy">
                {{ activeFootprint.region === 'china' ? '国内' : '国外' }} · {{ activeFootprint.images.length }} 张图片
              </p>
            </div>
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
.map-card,
.footprint-detail-card,
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

.dual-map-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1rem;
}

.map-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  overflow: hidden;
  padding: 1rem;
}

.map-card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
}

.map-card-title {
  color: white;
  font-size: 0.92rem;
  font-weight: 900;
}

.map-card-count {
  color: rgba(148, 163, 184, 0.86);
  font-size: 0.72rem;
  font-family: 'Menlo', 'Consolas', monospace;
  white-space: nowrap;
}

.map-card-body {
  position: relative;
  min-height: 32rem;
  overflow: hidden;
  border: 1px solid rgba(53, 243, 255, 0.14);
  border-radius: 4px;
  background: rgba(7, 7, 19, 0.5);
}

.footprint-detail-card {
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.map-overview-button {
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0.04) 45%, rgba(255, 255, 255, 0.1) 100%),
    rgba(7, 10, 24, 0.32);
  padding: 0.32rem 0.78rem;
  color: rgb(241, 245, 249);
  cursor: pointer;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  backdrop-filter: blur(18px) saturate(170%);
  -webkit-backdrop-filter: blur(18px) saturate(170%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.24), 0 6px 18px rgba(0, 0, 0, 0.28);
  transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}

.map-overview-button:hover,
.map-overview-button:focus-visible {
  border-color: rgba(53, 243, 255, 0.5);
  color: white;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 8px 22px rgba(53, 243, 255, 0.26);
  outline: none;
}

.active-point {
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr);
  gap: 0.85rem;
  align-items: center;
}

.active-cover {
  display: block;
  width: 5.5rem;
  height: 5.5rem;
  border-radius: 4px;
  object-fit: cover;
}

.active-point-body {
  min-width: 0;
}

.active-point-body h3 {
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
  margin: 0.45rem 0 0;
  color: rgba(203, 213, 225, 0.78);
  font-size: 0.82rem;
}

.point-image-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr));
  gap: 0.55rem;
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
  position: relative;
  min-height: 42rem;
  overflow: hidden;
  padding: 1rem;
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

@media (max-width: 1024px) {
  .footprint-hero {
    flex-wrap: wrap;
    row-gap: 0.5rem;
  }

  .dual-map-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .footprint-page {
    padding-right: 0.75rem;
    padding-left: 0.75rem;
  }

  .map-card-body {
    min-height: 24rem;
  }
}
</style>
