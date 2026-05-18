<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ImageRecord } from './image.types';
import { buildHtml, buildMarkdown, buildPublicPageUrl } from './image-links';

// og:image 注入位置占位
// 阶段 5 拿到真实 ImageRecord 后，在 onMounted 中通过 document.head
// 动态写入 og:image / og:title / og:description（路由级 meta，不在 index.html 全局加）

// 阶段 2 临时本地对象，让链接生成器、复制按钮先跑通；阶段 5 接 GET /api/image/:key 后删掉
const sample: ImageRecord = {
  key: 'demo-sunset-pixelspace',
  title: '黄浦江日落',
  caption: '陆家嘴方向，2025-11 拍摄。',
  public_url: 'https://cdn.pixelspace.example.com/img/demo-sunset-pixelspace.webp',
  width: 2048,
  height: 1365,
  format: 'webp',
  location_name: '上海 · 外滩',
};

const origin = typeof window !== 'undefined' ? window.location.origin : 'https://pixelspace.example.com';

const linkRows = computed(() => [
  { label: 'Markdown', value: buildMarkdown(sample) },
  { label: 'HTML', value: buildHtml(sample) },
  { label: '公开页直链', value: buildPublicPageUrl(sample, origin) },
]);

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

    <article class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <figure class="cyber-panel overflow-hidden rounded-[2rem]">
        <div
          class="w-full bg-void/60"
          :style="{ aspectRatio: `${sample.width} / ${sample.height}` }"
          :aria-label="`${sample.title} 占位`"
        ></div>
      </figure>

      <section class="cyber-panel mt-6 rounded-[2rem] p-8">
        <h1 class="text-2xl font-black text-white">{{ sample.title }}</h1>
        <p v-if="sample.caption" class="mt-3 text-sm leading-relaxed text-slate-300">{{ sample.caption }}</p>
        <div class="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
          <span class="font-mono">{{ sample.width }} × {{ sample.height }} · {{ sample.format.toUpperCase() }}</span>
          <span v-if="sample.location_name" class="font-mono">📍 {{ sample.location_name }}</span>
        </div>
      </section>

      <section class="cyber-panel mt-6 rounded-[2rem] p-6 sm:p-8">
        <header class="mb-4 flex items-center justify-between">
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
    </article>
  </main>
</template>

<style scoped>
.link-row {
  display: grid;
  grid-template-columns: 5.5rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.875rem;
  background: rgba(7, 7, 19, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 0.625rem;
  transition: border-color 0.2s ease;
}

.link-row:hover {
  border-color: rgba(53, 243, 255, 0.25);
}

.link-label {
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgb(53, 243, 255);
}

.link-value {
  display: block;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.78rem;
  color: rgb(203, 213, 225);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.link-copy {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(148, 163, 184);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.link-copy:hover {
  color: rgb(53, 243, 255);
  border-color: rgba(53, 243, 255, 0.45);
  background: rgba(53, 243, 255, 0.08);
}

@media (max-width: 640px) {
  .link-row {
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
  }
  .link-label {
    grid-column: 1 / 2;
  }
  .link-copy {
    grid-column: 2 / 3;
    grid-row: 1 / 2;
  }
  .link-value {
    grid-column: 1 / 3;
    grid-row: 2 / 3;
  }
}
</style>
