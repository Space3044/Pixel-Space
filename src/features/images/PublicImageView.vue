<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import type { ImageRecord } from './image.types';
import { buildHtml, buildMarkdown, buildPublicPageUrl } from './image-links';
import { fetchImage } from './images.api';
import ReadOnlyMap from './ReadOnlyMap.vue';

// og:image 注入位置占位
// 阶段 10 拿到 image 后在 onMounted 中通过 document.head 动态写入
// og:image / og:title / og:description（路由级 meta，不在 index.html 全局加）

const route = useRoute();
const image = ref<ImageRecord | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);

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
  ensureMeta('og:image', image.public_url);
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

const origin = typeof window !== 'undefined' ? window.location.origin : '';

const linkRows = computed(() => {
  if (!image.value) return [];
  return [
    { label: 'Markdown', value: buildMarkdown(image.value) },
    { label: 'HTML', value: buildHtml(image.value) },
    { label: '公开页直链', value: buildPublicPageUrl(image.value, origin) },
  ];
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

const copiedLabel = ref<string | null>(null);
let copyTimer: ReturnType<typeof setTimeout> | null = null;

const copy = async (label: string, value: string) => {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    return;
  }
  copiedLabel.value = label;
  if (copyTimer) clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    copiedLabel.value = null;
  }, 1400);
};

const COPY_ICON = {
  vb: '0 0 448 512',
  d: 'M208 0H332.1c12.7 0 24.9 5.1 33.9 14.1l67.9 67.9c9 9 14.1 21.2 14.1 33.9V336c0 26.5-21.5 48-48 48H208c-26.5 0-48-21.5-48-48V48c0-26.5 21.5-48 48-48zM48 128h80v64H64V448H256V416h64v48c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V176c0-26.5 21.5-48 48-48z',
};

const CHECK_ICON = {
  vb: '0 0 448 512',
  d: 'M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z',
};
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

    <article class="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
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

            <section
              v-if="image.location_lat !== null && image.location_lng !== null"
              class="public-info-card cyber-panel"
            >
              <p class="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-neon-cyan">Location</p>
              <ReadOnlyMap
                :lat="image.location_lat"
                :lng="image.location_lng"
                :label="image.location_name || image.title"
              />
            </section>

            <section class="public-info-card cyber-panel">
              <header class="mb-4 flex items-center justify-between gap-3">
                <p class="text-xs font-bold uppercase tracking-[0.3em] text-neon-cyan">Copy Links</p>
                <span v-if="copiedLabel" class="text-xs font-semibold text-neon-lime">{{ copiedLabel }} 已复制</span>
              </header>

              <ul class="space-y-3">
                <li v-for="row in linkRows" :key="row.label" class="link-row">
                  <span class="link-label">{{ row.label }}</span>
                  <code class="link-value">{{ row.value }}</code>
                  <button
                    type="button"
                    class="link-copy"
                    :aria-label="`复制 ${row.label}`"
                    @click="copy(row.label, row.value)"
                  >
                    <svg
                      :viewBox="copiedLabel === row.label ? CHECK_ICON.vb : COPY_ICON.vb"
                      fill="currentColor"
                      class="h-3.5 w-3.5"
                      aria-hidden="true"
                    >
                      <path :d="copiedLabel === row.label ? CHECK_ICON.d : COPY_ICON.d" />
                    </svg>
                    <span>{{ copiedLabel === row.label ? '已复制' : '复制' }}</span>
                  </button>
                </li>
              </ul>
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
  grid-template-columns: minmax(0, 1fr) 24rem;
  align-items: stretch;
  gap: 1.5rem;
}

.public-image-preview {
  display: flex;
  align-items: center;
  justify-content: center;
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
  gap: 1rem;
}

.public-info-card {
  border-radius: 6px;
  padding: 1.25rem;
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

.link-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: auto auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.875rem;
  background: rgba(7, 7, 19, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  transition: border-color 0.2s ease;
}

.link-row:hover {
  border-color: rgba(53, 243, 255, 0.25);
}

.link-label {
  grid-column: 1 / 2;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgb(53, 243, 255);
}

.link-value {
  display: block;
  grid-column: 1 / 3;
  grid-row: 2 / 3;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.78rem;
  color: rgb(203, 213, 225);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.link-copy {
  display: inline-flex;
  grid-column: 2 / 3;
  grid-row: 1 / 2;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(148, 163, 184);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.link-copy:hover {
  color: rgb(53, 243, 255);
  border-color: rgba(53, 243, 255, 0.45);
  background: rgba(53, 243, 255, 0.08);
}

@media (max-width: 900px) {
  .public-image-layout {
    grid-template-columns: 1fr;
  }

  .public-image-img {
    height: auto;
    max-height: none;
  }
}
</style>
