<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import AppShell from '@/shared/ui/AppShell.vue';
import type { ImageRecord } from '@/features/images/image.types';
import { buildAbsoluteImageUrl, buildHtml, buildMarkdown, buildPublicPageUrl } from '@/features/images/image-links';
import { listImages } from '@/features/images/images.api';
import ReadOnlyMap from '@/features/images/ReadOnlyMap.vue';

const loading = ref(false);
const loadError = ref<string | null>(null);
const images = ref<ImageRecord[]>([]);
const image = ref<ImageRecord | null>(null);
const copiedLabel = ref<string | null>(null);

const origin = typeof window !== 'undefined' ? window.location.origin : '';
let copyTimer: ReturnType<typeof setTimeout> | null = null;

const ROTATE = { vb: '0 0 512 512', d: 'M105.1 202.6c7.7-21.8 20.2-42.3 37.8-59.8c62.5-62.5 163.8-62.5 226.3 0L386.3 160H352c-17.7 0-32 14.3-32 32s14.3 32 32 32H463.5c0 0 0 0 0 0h.4c17.7 0 32-14.3 32-32V80c0-17.7-14.3-32-32-32s-32 14.3-32 32v35.2L414.4 97.6c-87.5-87.5-229.3-87.5-316.8 0C73.2 122 55.6 150.7 44.8 181.4c-5.9 16.7 2.9 34.9 19.5 40.8s34.9-2.9 40.8-19.5zM39 289.3c-5 1.5-9.8 4.2-13.7 8.2c-4 4-6.7 8.8-8.1 14c-.3 1.2-.6 2.5-.8 3.8c-.3 1.7-.4 3.4-.4 5.1V432c0 17.7 14.3 32 32 32s32-14.3 32-32V396.9l17.6 17.5 0 0c87.5 87.4 229.3 87.4 316.7 0c24.4-24.4 42.1-53.1 52.9-83.7c5.9-16.7-2.9-34.9-19.5-40.8s-34.9 2.9-40.8 19.5c-7.7 21.8-20.2 42.3-37.8 59.8c-62.5 62.5-163.8 62.5-226.3 0l-.1-.1L125.6 352H160c17.7 0 32-14.3 32-32s-14.3-32-32-32H48.4c-1.6 0-3.2 .1-4.8 .3s-3.1 .5-4.6 1z' };
const COPY_ICON = { vb: '0 0 448 512', d: 'M208 0H332.1c12.7 0 24.9 5.1 33.9 14.1l67.9 67.9c9 9 14.1 21.2 14.1 33.9V336c0 26.5-21.5 48-48 48H208c-26.5 0-48-21.5-48-48V48c0-26.5 21.5-48 48-48zM48 128h80v64H64V448H256V416h64v48c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V176c0-26.5 21.5-48 48-48z' };
const CHECK_ICON = { vb: '0 0 448 512', d: 'M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z' };

const tagsFromImage = (record: ImageRecord | null): string[] => {
  if (!record?.tags_json) return [];
  try {
    const parsed = JSON.parse(record.tags_json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((tag): tag is string => typeof tag === 'string')
      .map((tag) => tag.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
};

const paletteFromImage = (record: ImageRecord | null): string[] => {
  if (!record?.color_palette_json) return [];
  try {
    const parsed = JSON.parse(record.color_palette_json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((color): color is string => typeof color === 'string')
      .map((color) => color.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
};

const parseDominantColor = (value: string | null | undefined): { name: string; hex: string } => {
  const raw = value?.trim() ?? '';
  const hex = raw.match(/#[0-9a-fA-F]{6}\b/)?.[0].toUpperCase() ?? '';
  const name = hex ? raw.replace(new RegExp(hex, 'i'), '').trim() : raw;
  return {
    name: name || raw || '未记录',
    hex,
  };
};

const pickRandomImage = (records: ImageRecord[], currentKey: string | null): ImageRecord | null => {
  if (records.length === 0) return null;
  if (records.length === 1) return records[0];
  const pool = records.filter((record) => record.key !== currentKey);
  return pool[Math.floor(Math.random() * pool.length)] ?? records[0];
};

const refresh = async () => {
  if (loading.value) return;
  loading.value = true;
  loadError.value = null;

  try {
    if (images.value.length === 0) {
      images.value = await listImages();
    }
    image.value = pickRandomImage(images.value, image.value?.key ?? null);
  } catch (e) {
    loadError.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
};

const detailRows = computed(() => {
  const current = image.value;
  if (!current) return [];
  return [
    { label: '文件名', value: current.original_filename || current.key },
    { label: '尺寸', value: `${current.width} × ${current.height}` },
    { label: '快门', value: current.exif_shutter || '未记录' },
    { label: 'ISO', value: current.exif_iso === null ? '未记录' : `ISO ${current.exif_iso}` },
    { label: '光圈', value: current.exif_aperture === null ? '未记录' : `f/${current.exif_aperture}` },
    { label: '焦距', value: current.exif_focal_length === null ? '未记录' : `${current.exif_focal_length} mm` },
  ];
});

const tags = computed(() => tagsFromImage(image.value));
const aiPalette = computed(() => paletteFromImage(image.value));
const dominantColor = computed(() => parseDominantColor(image.value?.dominant_color));
const locationName = computed(() => image.value?.location_name?.trim() || '未记录');

const linkRows = computed(() => {
  const current = image.value;
  if (!current) return [];
  const imageUrl = buildAbsoluteImageUrl(current.public_url, origin);
  const imageForCopy = { ...current, public_url: imageUrl };
  return [
    { label: '图片直链', value: imageUrl },
    { label: 'Markdown', value: buildMarkdown(imageForCopy) },
    { label: 'HTML', value: buildHtml(imageForCopy) },
    { label: '公开页', value: buildPublicPageUrl(current, origin) },
  ];
});

const copyLink = async (label: string, value: string) => {
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

const handleKey = (e: KeyboardEvent) => {
  const tag = (document.activeElement?.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    void refresh();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKey);
  void refresh();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKey);
  if (copyTimer) clearTimeout(copyTimer);
});
</script>

<template>
  <AppShell fluid>
    <div class="random-page">
      <section class="random-hero">
        <figure class="random-image-frame cyber-panel" :class="{ 'is-loading': loading }">
          <img
            v-if="image"
            :src="image.public_url"
            :alt="image.title"
            class="random-main-image"
          />
          <div v-else class="random-empty">
            <p class="text-xl font-black text-white">暂无图片</p>
            <p class="mt-2 text-sm text-slate-400">上传图片后，随机页会从图库里抽取一张展示。</p>
          </div>
          <div class="random-image-grid" aria-hidden="true" />
        </figure>
        <p v-if="loadError" class="mt-3 text-sm font-semibold text-rose-300">加载失败：{{ loadError }}</p>
      </section>

      <section class="random-details-section">
        <div class="random-detail-grid">
          <article class="random-card cyber-panel">
            <div class="card-heading text-neon-cyan">
              <span class="heading-mark bg-neon-cyan" />
              <span>File Detail</span>
            </div>
            <dl v-if="image" class="detail-list">
              <div v-for="row in detailRows" :key="row.label" class="detail-row">
                <dt>{{ row.label }}</dt>
                <dd>{{ row.value }}</dd>
              </div>
            </dl>
            <div v-if="image" class="location-map-block">
              <div class="location-map-heading">
                <span>位置</span>
                <span class="location-map-state">{{ locationName }}</span>
              </div>
              <ReadOnlyMap
                :lat="image.location_lat"
                :lng="image.location_lng"
                :label="image.location_name || image.title"
              />
            </div>
            <p v-else class="mt-4 text-sm text-slate-400">暂无图片信息</p>
          </article>

          <article class="random-card cyber-panel">
            <div class="card-heading text-neon-pink">
              <span class="heading-mark bg-neon-pink" />
              <span>AI Analysis</span>
            </div>
            <template v-if="image">
              <h3 class="ai-title">{{ image.title }}</h3>
              <p class="ai-caption">{{ image.caption || '暂无描述' }}</p>
              <div v-if="tags.length" class="tag-list">
                <span v-for="tag in tags" :key="tag" class="tag-pill">{{ tag }}</span>
              </div>
              <p v-else class="mt-4 text-sm text-slate-500">暂无标签</p>
              <div class="ai-visual-grid">
                <div class="ai-visual-item is-inline">
                  <span>主色调</span>
                  <span
                    v-if="image.dominant_color"
                    class="dominant-color-value"
                    :title="dominantColor.hex || image.dominant_color"
                  >
                    <span
                      v-if="dominantColor.hex"
                      class="palette-chip dominant-color-chip"
                      :style="{ backgroundColor: dominantColor.hex }"
                      aria-hidden="true"
                    />
                    <span class="dominant-color-name">{{ dominantColor.name }}</span>
                  </span>
                  <p v-else class="ai-muted">未记录</p>
                </div>
                <div class="ai-visual-item is-inline is-palette">
                  <span>色板</span>
                  <div v-if="aiPalette.length" class="palette-list">
                    <span
                      v-for="color in aiPalette"
                      :key="color"
                      class="palette-chip"
                      :style="{ backgroundColor: color }"
                      :title="color"
                    />
                  </div>
                  <p v-else class="ai-muted">未记录</p>
                </div>
                <div class="ai-visual-item is-wide">
                  <span>构图</span>
                  <p>{{ image.composition || '未记录' }}</p>
                </div>
              </div>
            </template>
            <p v-else class="mt-4 text-sm text-slate-400">暂无 AI 分析</p>
          </article>

          <article class="random-card cyber-panel">
            <div class="card-heading text-neon-violet">
              <div class="flex items-center gap-2">
                <span class="heading-mark bg-neon-violet" />
                <span>Copy Links</span>
              </div>
              <span v-if="copiedLabel" class="text-xs font-semibold text-neon-lime">{{ copiedLabel }} 已复制</span>
            </div>
            <ul v-if="image" class="link-list">
              <li v-for="row in linkRows" :key="row.label" class="link-row">
                <span class="link-label">{{ row.label }}</span>
                <code class="link-value">{{ row.value }}</code>
                <button type="button" class="link-copy" :aria-label="`复制 ${row.label}`" @click="copyLink(row.label, row.value)">
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
            <p v-else class="mt-4 text-sm text-slate-400">暂无可复制链接</p>
          </article>
        </div>
      </section>
    </div>

    <button
      type="button"
      class="refresh-btn"
      :disabled="loading"
      :aria-label="loading ? '加载中' : '再来一张'"
      @click="refresh"
    >
      <svg :viewBox="ROTATE.vb" fill="currentColor" class="h-4 w-4" :class="{ 'animate-spin': loading }" aria-hidden="true"><path :d="ROTATE.d" /></svg>
    </button>

    <aside class="hint-card" aria-label="键盘提示">
      <span class="text-[11px] font-medium text-slate-300">键盘快捷键</span>
      <span class="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
        <kbd>Space</kbd>
        <span>换一张</span>
      </span>
    </aside>
  </AppShell>
</template>

<style scoped>
.random-page {
  padding: 0 0 2rem;
}

.random-hero {
  width: min(100%, 1600px);
  margin: 0 auto;
  padding: 0 1rem 1.25rem;
}

.random-image-frame {
  position: relative;
  display: flex;
  height: calc(100svh - 4rem);
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 6px;
  background:
    radial-gradient(circle at 22% 18%, rgba(53, 243, 255, 0.1), transparent 30%),
    radial-gradient(circle at 80% 70%, rgba(255, 79, 216, 0.09), transparent 34%),
    rgba(7, 7, 19, 0.72);
  transition: opacity 0.25s ease;
}

.random-image-frame.is-loading {
  opacity: 0.72;
}

.random-main-image {
  position: relative;
  z-index: 1;
  display: block;
  width: auto;
  height: auto;
  max-width: calc(100% - 2rem);
  max-height: calc(100svh - 4rem);
  object-fit: contain;
}

.random-empty {
  position: relative;
  z-index: 1;
  max-width: 24rem;
  padding: 2rem;
  text-align: center;
}

.random-image-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(53, 243, 255, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(53, 243, 255, 0.06) 1px, transparent 1px);
  background-size: 42px 42px;
  mask-image: radial-gradient(circle at center, black 0%, transparent 72%);
  pointer-events: none;
}

.random-details-section {
  width: min(100%, 1600px);
  margin: 0 auto;
  padding: 0 1rem 2rem;
}

.random-detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(0, 0.94fr) minmax(320px, 0.94fr);
  gap: 1rem;
  align-items: start;
}

.random-card {
  min-height: 100%;
  border-radius: 6px;
  padding: 1rem;
}

.card-heading {
  display: flex;
  min-height: 1.5rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.heading-mark {
  display: inline-block;
  width: 0.375rem;
  height: 0.375rem;
}

.detail-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.625rem;
  margin-top: 1rem;
}

.detail-row {
  min-width: 0;
  min-height: 4rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  background: rgba(7, 7, 19, 0.42);
  padding: 0.625rem 0.75rem;
}

.detail-row dt {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: rgba(148, 163, 184, 0.86);
}

.detail-row dd {
  margin-top: 0.35rem;
  min-width: 0;
  overflow-wrap: anywhere;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.8rem;
  color: rgb(226, 232, 240);
}

.location-map-block {
  margin-top: 0.75rem;
}

.location-map-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: rgba(148, 163, 184, 0.86);
}

.location-map-state {
  letter-spacing: 0;
  color: rgba(148, 163, 184, 0.72);
  font-size: 0.72rem;
}

.location-map-block :deep(.readonly-map) {
  height: 176px;
  border-radius: 4px;
}

.ai-title {
  margin-top: 1rem;
  color: white;
  font-size: 1.1rem;
  font-weight: 900;
}

.ai-caption {
  margin-top: 0.75rem;
  border: 1px solid rgba(255, 79, 216, 0.1);
  border-radius: 4px;
  background: rgba(7, 7, 19, 0.34);
  padding: 0.875rem;
  color: rgb(203, 213, 225);
  font-size: 0.9rem;
  line-height: 1.75;
}

.ai-visual-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.625rem;
  margin-top: 1rem;
}

.ai-visual-item {
  min-width: 0;
  border: 1px solid rgba(255, 79, 216, 0.12);
  border-radius: 4px;
  background: rgba(7, 7, 19, 0.34);
  padding: 0.625rem 0.75rem;
}

.ai-visual-item.is-inline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  white-space: nowrap;
}

.ai-visual-item.is-wide {
  grid-column: 1 / -1;
}

.ai-visual-item > span {
  display: block;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(244, 114, 182, 0.78);
}

.ai-visual-item.is-inline > span:first-child {
  flex: 0 0 auto;
}

.ai-visual-item > .dominant-color-value {
  display: inline-flex;
}

.ai-visual-item.is-inline p {
  margin-top: 0;
}

.ai-visual-item p {
  display: block;
  margin-top: 0.4rem;
  color: rgb(226, 232, 240);
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1.65;
}

.ai-visual-item p {
  margin-bottom: 0;
  font-weight: 500;
}

.dominant-color-value {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 0.375rem;
  margin-top: 0;
  color: rgb(226, 232, 240);
  font-size: 0.82rem;
  font-weight: 700;
}

.dominant-color-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-muted {
  color: rgba(148, 163, 184, 0.72) !important;
}

.palette-list {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.palette-list::-webkit-scrollbar {
  display: none;
}

.palette-chip {
  display: inline-block;
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.18);
}

.dominant-color-chip {
  width: 20px;
  height: 20px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}

.tag-pill {
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(255, 79, 216, 0.25);
  border-radius: 4px;
  background: rgba(255, 79, 216, 0.08);
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: rgb(244, 194, 235);
}

.link-list {
  margin-top: 1rem;
}

.link-list > * + * {
  margin-top: 0.75rem;
}

.link-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: auto auto;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  background: rgba(7, 7, 19, 0.5);
  padding: 0.625rem 0.75rem;
}

.link-label {
  grid-column: 1 / 2;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgb(167, 139, 250);
}

.link-value {
  display: block;
  grid-column: 1 / 3;
  grid-row: 2 / 3;
  overflow: hidden;
  color: rgb(203, 213, 225);
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.78rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.link-copy {
  display: inline-flex;
  grid-column: 2 / 3;
  grid-row: 1 / 2;
  align-items: center;
  gap: 0.375rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
  color: rgb(148, 163, 184);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.375rem 0.75rem;
  transition: all 0.2s ease;
}

.link-copy:hover {
  border-color: rgba(167, 139, 250, 0.5);
  background: rgba(167, 139, 250, 0.1);
  color: rgb(221, 214, 254);
}

.refresh-btn {
  position: fixed;
  right: 1.5rem;
  bottom: 1.5rem;
  z-index: 30;
  display: flex;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(53, 243, 255, 0.3);
  border-radius: 6px;
  background: rgba(53, 243, 255, 0.1);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  color: rgb(53, 243, 255);
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: all 0.2s ease;
}

.refresh-btn:hover:not(:disabled) {
  border-color: rgba(53, 243, 255, 0.55);
  background: rgba(53, 243, 255, 0.18);
}

.refresh-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.hint-card {
  position: fixed;
  bottom: 1.5rem;
  left: 1.5rem;
  z-index: 30;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(53, 243, 255, 0.2);
  border-radius: 6px;
  background: rgba(7, 7, 19, 0.5);
  padding: 0.5rem 0.75rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(20px);
}

.hint-card kbd {
  display: inline-block;
  min-width: 1.2rem;
  border: 1px solid rgba(53, 243, 255, 0.3);
  border-radius: 4px;
  background: rgba(53, 243, 255, 0.1);
  color: rgb(53, 243, 255);
  font-family: 'Courier New', monospace;
  font-size: 0.6rem;
  padding: 0.1rem 0.3rem;
  text-align: center;
}

@media (max-width: 768px) {
  .random-page {
    padding-top: 0.5rem;
  }

  .random-hero,
  .random-details-section {
    padding-right: 0.75rem;
    padding-left: 0.75rem;
  }

  .random-image-frame {
    height: calc(100svh - 4rem);
  }

  .random-main-image {
    max-width: calc(100% - 1rem);
    max-height: calc(100svh - 4rem);
  }

  .refresh-btn {
    right: 1rem;
    bottom: 1rem;
    width: 40px;
    height: 40px;
  }

  .hint-card {
    bottom: 1rem;
    left: 1rem;
  }

  .random-detail-grid,
  .detail-list {
    grid-template-columns: 1fr;
  }
}
</style>
