<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import type { ImageRecord } from './image.types';
import { buildAbsoluteImageUrl } from './image-links';
import { fetchImage } from './images.api';
import ReadOnlyMap from './ReadOnlyMap.vue';

// 图片加载后写入路由级 og:image / og:title / og:description，不在 index.html 全局加。

const route = useRoute();
const image = ref<ImageRecord | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);
const origin = typeof window !== 'undefined' ? window.location.origin : '';

const ensureMeta = (property: string, content: string) => {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('property', property);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
};

const updateOpenGraph = (image: ImageRecord) => {
  ensureMeta('og:image', buildAbsoluteImageUrl(image.public_url, origin));
  ensureMeta('og:title', image.title || 'Pixel Space 图片');
  ensureMeta('og:description', image.caption || image.location_name || 'Pixel Space 公开图片');
};

onMounted(async () => {
  const key = String(route.params.key ?? '');
  try {
    image.value = await fetchImage(key);
    updateOpenGraph(image.value);
  } catch (e) {
    loadError.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
});

const exifRows = computed(() => {
  const current = image.value;
  if (!current) return [];
  return [
    {
      label: '快门',
      value: current.exif_shutter || '未记录',
      muted: !current.exif_shutter,
    },
    {
      label: 'ISO',
      value: current.exif_iso === null ? '未记录' : `ISO ${current.exif_iso}`,
      muted: current.exif_iso === null,
    },
    {
      label: '光圈',
      value: current.exif_aperture === null ? '未记录' : `f/${current.exif_aperture}`,
      muted: current.exif_aperture === null,
    },
    {
      label: '焦距',
      value: current.exif_focal_length === null ? '未记录' : `${current.exif_focal_length} mm`,
      muted: current.exif_focal_length === null,
    },
  ];
});
</script>

<template>
  <main class="min-h-screen bg-grid bg-[length:32px_32px]">
    <header class="border-b border-white/10 bg-void/80 backdrop-blur-xl">
      <div class="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <RouterLink to="/" class="flex items-center gap-1.5 font-mono text-base font-black leading-none tracking-wider">
          <span class="text-neon-cyan [text-shadow:0_0_8px_rgba(53,243,255,0.7)]">Pixel</span>
          <span class="text-neon-pink [text-shadow:0_0_8px_rgba(255,79,216,0.7)]">Space</span>
        </RouterLink>
        <RouterLink to="/images" class="text-sm font-semibold text-slate-300 hover:text-white">
          返回图库
        </RouterLink>
      </div>
    </header>

    <article class="mx-auto w-full max-w-[90rem] px-4 py-8 sm:px-6">
      <p v-if="loading" class="text-sm text-slate-500">加载中…</p>
      <p v-else-if="loadError" class="text-sm text-rose-400">加载失败：{{ loadError }}</p>
      <template v-else-if="image">
        <div class="public-image-layout">
          <figure class="public-image-preview cyber-panel">
            <img
              :src="image.public_url"
              :alt="image.title"
              class="public-image-img"
              :style="{ aspectRatio: `${image.width} / ${image.height}` }"
            />
          </figure>

          <aside class="public-image-info">
            <section class="public-info-card cyber-panel">
              <h1 class="text-2xl font-black text-white">{{ image.title }}</h1>
              <p v-if="image.caption" class="mt-3 text-sm leading-relaxed text-slate-300">{{ image.caption }}</p>
              <div class="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
                <span class="font-mono">{{ image.width }} × {{ image.height }} · {{ image.format.toUpperCase() }}</span>
                <span v-if="image.location_name" class="font-mono">📍 {{ image.location_name }}</span>
              </div>
              <dl class="public-exif-grid">
                <div v-for="row in exifRows" :key="row.label" class="public-exif-item">
                  <dt>{{ row.label }}</dt>
                  <dd :class="{ 'is-muted': row.muted }">{{ row.value }}</dd>
                </div>
              </dl>
            </section>

            <section class="public-info-card cyber-panel">
              <p class="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-neon-cyan">Location</p>
              <ReadOnlyMap
                :lat="image.location_public === 0 ? null : image.location_lat"
                :lng="image.location_public === 0 ? null : image.location_lng"
                :region="image.location_public === 0 ? null : image.location_region"
                :label="image.location_name || image.title"
              />
            </section>
          </aside>
        </div>
      </template>
    </article>
  </main>
</template>

<style scoped>
.public-image-layout {
  display: grid;
  grid-template-columns: minmax(0, 60rem) 24rem;
  align-items: start;
  justify-content: center;
  gap: 1.5rem;
}

.public-image-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  height: clamp(32rem, calc(100vh - 8rem), 48rem);
  overflow: hidden;
  border-radius: 6px;
}

.public-image-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: rgba(7, 7, 19, 0.72);
}

.public-image-info {
  display: flex;
  flex-direction: column;
  height: clamp(32rem, calc(100vh - 8rem), 48rem);
  gap: 1rem;
}

.public-info-card {
  border-radius: 6px;
  padding: 1.25rem;
}

.public-image-info > .public-info-card:first-child {
  flex: 1 1 auto;
}

.public-image-info > .public-info-card:nth-child(2) {
  flex: 0 0 auto;
}

.public-exif-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.625rem;
  margin-top: 1rem;
}

.public-exif-item {
  border: 1px solid rgba(53, 243, 255, 0.12);
  border-radius: 6px;
  background: rgba(7, 7, 19, 0.46);
  padding: 0.625rem 0.75rem;
}

.public-exif-item dt {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(103, 232, 249, 0.78);
}

.public-exif-item dd {
  margin-top: 0.35rem;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.78rem;
  color: rgb(226, 232, 240);
}

.public-exif-item dd.is-muted {
  color: rgba(148, 163, 184, 0.7);
}

@media (max-width: 900px) {
  .public-image-layout {
    grid-template-columns: 1fr;
  }

  .public-image-preview {
    height: clamp(22rem, 72vh, 40rem);
  }

  .public-image-info {
    height: auto;
  }

  .public-image-img {
    height: 100%;
  }
}
</style>
