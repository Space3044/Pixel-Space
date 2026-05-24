<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppShell from '@/shared/ui/AppShell.vue';
import type { ImageRecord } from '@/features/images/image.types';

interface StatsResponse {
  photos: number;
  storage_bytes: number;
  ai_tagged: number;
  places: number;
  latest: ImageRecord[];
}

const stats = ref<StatsResponse | null>(null);
const loading = ref(true);

const formatNumber = (value: number): string => value.toLocaleString('en-US');

const formatBytes = (bytes: number): string => {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i <= 1 ? 0 : 1)} ${units[i]}`;
};

const photosLabel = computed(() => (stats.value ? formatNumber(stats.value.photos) : '--'));
const storageLabel = computed(() => (stats.value ? formatBytes(stats.value.storage_bytes) : '--'));
const placesLabel = computed(() => (stats.value ? formatNumber(stats.value.places) : '--'));

const latest = computed(() => stats.value?.latest ?? []);

onMounted(async () => {
  try {
    const response = await fetch('/api/stats');
    if (response.ok) {
      stats.value = (await response.json()) as StatsResponse;
    }
  } catch {
    // 首页统计接口失败时降级显示 -- 占位，不阻塞页面渲染。
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <AppShell fluid>
    <div class="relative isolate overflow-hidden">
      <div aria-hidden="true" class="pointer-events-none absolute inset-0 -z-10">
        <div class="absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-neon-cyan/20 blur-3xl"></div>
        <div class="absolute -bottom-24 right-1/4 h-80 w-80 rounded-full bg-neon-pink/20 blur-3xl"></div>
        <div class="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-neon-violet/15 blur-3xl"></div>
        <div class="hero-grid absolute inset-0 opacity-40"></div>
      </div>

      <section class="mx-auto flex max-w-5xl flex-col items-center px-6 py-20 text-center sm:py-28">
        <p class="hero-eyebrow">
          <span class="status-dot" aria-hidden="true"></span>
          Personal Image Hosting · Edge Native
        </p>

        <h1 class="mt-6 text-5xl font-black leading-none tracking-tight text-white sm:text-7xl lg:text-8xl">
          <span class="bg-gradient-to-r from-neon-cyan via-white to-neon-pink bg-clip-text text-transparent">Pixel Space</span>
        </h1>

        <p class="mt-8 max-w-2xl text-lg text-slate-200 sm:text-xl">
          一个属于自己的像素空间。拖入即上传，AI 在后台标注与压缩，链接随手分享，原图安心归档。
        </p>
        <p class="mt-3 max-w-xl text-sm text-slate-400">
          Cloudflare Pages · D1 · R2 · Telegram 原图托管 · 端到端走在边缘节点
        </p>

        <div class="mt-10 flex flex-wrap items-center justify-center gap-3">
          <RouterLink to="/images" class="hero-cta cta-primary">
            <span class="cta-glow" aria-hidden="true"></span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="cta-icon" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span class="cta-label">探索图库</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="cta-arrow" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </RouterLink>

          <RouterLink to="/upload" class="hero-cta cta-secondary">
            <span class="cta-glow" aria-hidden="true"></span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="cta-icon" aria-hidden="true">
              <path d="M12 3v12" />
              <path d="m6 9 6-6 6 6" />
              <path d="M5 21h14" />
            </svg>
            <span class="cta-label">开始上传</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="cta-arrow" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </RouterLink>

          <RouterLink to="/random" class="hero-cta cta-ghost">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="cta-icon" aria-hidden="true">
              <path d="M16 3h5v5" />
              <path d="M4 20 21 3" />
              <path d="M21 16v5h-5" />
              <path d="m15 15 6 6" />
              <path d="M4 4l5 5" />
            </svg>
            <span class="cta-label">随机一张</span>
          </RouterLink>
        </div>

        <dl class="mt-16 grid w-full max-w-3xl grid-cols-3 gap-6 sm:gap-8">
          <div class="stat-cell">
            <dt class="stat-label">Photos</dt>
            <dd class="stat-value">{{ photosLabel }}</dd>
            <p class="stat-hint">已收录公开图片</p>
          </div>
          <div class="stat-cell">
            <dt class="stat-label">Storage</dt>
            <dd class="stat-value">{{ storageLabel }}</dd>
            <p class="stat-hint">压缩后占用</p>
          </div>
          <div class="stat-cell">
            <dt class="stat-label">Places</dt>
            <dd class="stat-value">{{ placesLabel }}</dd>
            <p class="stat-hint">点亮的地点</p>
          </div>
        </dl>
      </section>

      <section v-if="latest.length > 0" class="mx-auto max-w-7xl px-6 pb-16">
        <header class="flex items-end justify-between gap-3 pb-4">
          <div>
            <p class="text-[0.65rem] font-bold uppercase tracking-[0.35em] text-neon-cyan">Latest Drops</p>
            <h2 class="mt-1 text-xl font-black text-white sm:text-2xl">最近的入库</h2>
          </div>
          <RouterLink to="/images" class="text-xs font-semibold tracking-wider text-slate-300 hover:text-neon-cyan">
            探索全部 →
          </RouterLink>
        </header>
        <div class="latest-strip">
          <RouterLink
            v-for="item in latest"
            :key="item.key"
            :to="`/p/${encodeURIComponent(item.key)}`"
            class="latest-card"
          >
            <img :src="item.public_url" :alt="item.title || item.original_filename" loading="lazy" />
            <div class="latest-overlay">
              <span class="latest-title">{{ item.title || item.original_filename }}</span>
              <span class="latest-meta">{{ item.width }} × {{ item.height }} · {{ item.format.toUpperCase() }}</span>
            </div>
          </RouterLink>
        </div>
      </section>

      <section class="mx-auto max-w-7xl px-6 pb-16">
        <header class="pb-5 text-center">
          <p class="text-[0.65rem] font-bold uppercase tracking-[0.35em] text-neon-cyan">How it works</p>
          <h2 class="mt-1 text-xl font-black text-white sm:text-2xl">从拖入到分享，只走四步</h2>
        </header>
        <ol class="workflow-grid">
          <li class="workflow-step">
            <span class="workflow-index">01</span>
            <h3 class="workflow-title">拖入文件</h3>
            <p class="workflow-desc">浏览器端做 SHA-256 去重、EXIF 解析与压缩，原图与缩图同时准备。</p>
          </li>
          <li class="workflow-step">
            <span class="workflow-index">02</span>
            <h3 class="workflow-title">边缘存储</h3>
            <p class="workflow-desc">压缩图入 R2 走 Cloudflare CDN；原图发到 Telegram 私有频道当作冷归档。</p>
          </li>
          <li class="workflow-step">
            <span class="workflow-index">03</span>
            <h3 class="workflow-title">AI 标注</h3>
            <p class="workflow-desc">后台异步生成标题、描述、标签、主色调和构图，全部沉淀进 D1。</p>
          </li>
          <li class="workflow-step">
            <span class="workflow-index">04</span>
            <h3 class="workflow-title">链接即分享</h3>
            <p class="workflow-desc">直链、Markdown、HTML 和公开页一并就绪，访客和地图聚合自动同步。</p>
          </li>
        </ol>
      </section>

      <section class="mx-auto max-w-7xl px-6 pb-24">
        <header class="pb-5">
          <p class="text-[0.65rem] font-bold uppercase tracking-[0.35em] text-neon-cyan">Stack &amp; Features</p>
          <h2 class="mt-1 text-xl font-black text-white sm:text-2xl">边缘原生的小而美</h2>
        </header>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article class="feature-card">
            <div class="feature-icon feature-icon-cyan">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5" aria-hidden="true">
                <path d="M12 2 2 7l10 5 10-5-10-5z" />
                <path d="m2 17 10 5 10-5" />
                <path d="m2 12 10 5 10-5" />
              </svg>
            </div>
            <h3 class="feature-title">Cloudflare 全栈</h3>
            <p class="feature-desc">Pages + Functions + D1 + R2，请求在边缘节点落地，国内外延迟都拉到最低。</p>
          </article>

          <article class="feature-card">
            <div class="feature-icon feature-icon-pink">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5" aria-hidden="true">
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
              </svg>
            </div>
            <h3 class="feature-title">AI 智能标注</h3>
            <p class="feature-desc">自动产出标题、描述、标签、主色调、色板与构图，搜索一并接入索引。</p>
          </article>

          <article class="feature-card">
            <div class="feature-icon feature-icon-violet">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z" />
                <path d="M3 12h18" />
                <path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
              </svg>
            </div>
            <h3 class="feature-title">足迹与地图</h3>
            <p class="feature-desc">带坐标的图自动点亮 MapLibre 热力与世界地球，旅行轨迹随上传慢慢长。</p>
          </article>

          <article class="feature-card">
            <div class="feature-icon feature-icon-lime">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h3 class="feature-title">Access 鉴权</h3>
            <p class="feature-desc">Cloudflare Access OTP + 邮箱白名单，管理路径只对你打开，访客只看到公开聚合。</p>
          </article>
        </div>
      </section>
    </div>
  </AppShell>
</template>

<style scoped>
.hero-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.25rem 0.85rem;
  border: 1px solid rgba(53, 243, 255, 0.35);
  border-radius: 999px;
  background: rgba(7, 7, 19, 0.55);
  color: rgb(165, 243, 252);
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  backdrop-filter: blur(10px);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: rgb(132, 247, 153);
  box-shadow: 0 0 8px rgba(132, 247, 153, 0.7);
  animation: status-pulse 2.4s ease-in-out infinite;
}

@keyframes status-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(0.82); }
}

.hero-grid {
  background-image:
    linear-gradient(rgba(53, 243, 255, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(53, 243, 255, 0.06) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
}

.hero-cta {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  min-height: 48px;
  padding: 0.85rem 1.4rem;
  border-radius: 999px;
  font-weight: 800;
  letter-spacing: 0.04em;
  overflow: hidden;
  isolation: isolate;
  transition:
    transform 220ms cubic-bezier(0.16, 1, 0.3, 1),
    border-color 220ms ease,
    box-shadow 220ms ease,
    color 220ms ease;
}

.hero-cta:hover {
  transform: translateY(-2px);
}

.hero-cta:active {
  transform: translateY(0);
}

.cta-icon,
.cta-arrow {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.cta-arrow {
  transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.hero-cta:hover .cta-arrow {
  transform: translateX(3px);
}

.cta-label {
  position: relative;
  z-index: 1;
}

.cta-glow {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: linear-gradient(120deg, transparent 25%, rgba(255, 255, 255, 0.32) 50%, transparent 75%);
  transform: translateX(-120%);
  transition: transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
}

.hero-cta:hover .cta-glow {
  transform: translateX(120%);
}

.cta-primary {
  border: 1px solid rgba(53, 243, 255, 0.55);
  background:
    linear-gradient(135deg, rgba(53, 243, 255, 0.28), rgba(53, 243, 255, 0.05) 60%, rgba(7, 7, 19, 0.6)),
    rgba(7, 7, 19, 0.4);
  color: rgb(220, 252, 255);
  box-shadow:
    0 8px 28px rgba(53, 243, 255, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.16);
}

.cta-primary:hover {
  border-color: rgba(53, 243, 255, 0.95);
  color: white;
  box-shadow:
    0 12px 36px rgba(53, 243, 255, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.22);
}

.cta-secondary {
  border: 1px solid rgba(255, 79, 216, 0.5);
  background:
    linear-gradient(135deg, rgba(255, 79, 216, 0.28), rgba(255, 79, 216, 0.05) 60%, rgba(7, 7, 19, 0.6)),
    rgba(7, 7, 19, 0.4);
  color: rgb(254, 222, 245);
  box-shadow:
    0 8px 28px rgba(255, 79, 216, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.14);
}

.cta-secondary:hover {
  border-color: rgba(255, 79, 216, 0.95);
  color: white;
  box-shadow:
    0 12px 36px rgba(255, 79, 216, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.22);
}

.cta-ghost {
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(15, 23, 42, 0.4);
  color: rgb(203, 213, 225);
  backdrop-filter: blur(8px);
}

.cta-ghost:hover {
  border-color: rgba(165, 243, 252, 0.5);
  color: rgb(220, 252, 255);
  background: rgba(15, 23, 42, 0.7);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.3);
}

.stat-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1rem 0.5rem;
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 1rem;
  background: rgba(7, 7, 19, 0.4);
  backdrop-filter: blur(12px);
}

.stat-label {
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.28em;
  color: rgb(165, 243, 252);
  text-transform: uppercase;
}

.stat-value {
  margin: 0.6rem 0 0.3rem;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 1.75rem;
  font-weight: 900;
  color: white;
  line-height: 1;
}

@media (min-width: 640px) {
  .stat-value {
    font-size: 2.25rem;
  }
}

.stat-hint {
  margin: 0;
  font-size: 0.72rem;
  color: rgba(148, 163, 184, 0.85);
}

.latest-strip {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: 0.75rem;
}

.latest-card {
  position: relative;
  display: block;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 0.85rem;
  background: rgba(7, 7, 19, 0.4);
  transition: border-color 200ms ease, transform 200ms ease, box-shadow 200ms ease;
}

.latest-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 400ms ease, opacity 400ms ease;
  opacity: 0.92;
}

.latest-card:hover {
  border-color: rgba(53, 243, 255, 0.55);
  transform: translateY(-2px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4), 0 0 22px rgba(53, 243, 255, 0.2);
}

.latest-card:hover img {
  transform: scale(1.06);
  opacity: 1;
}

.latest-overlay {
  position: absolute;
  inset: auto 0 0 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0.5rem 0.7rem;
  background: linear-gradient(180deg, transparent 0%, rgba(7, 7, 19, 0.85) 80%);
  color: white;
}

.latest-title {
  font-size: 0.78rem;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.latest-meta {
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.65rem;
  color: rgba(165, 243, 252, 0.78);
}

.workflow-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: 0.85rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.workflow-step {
  position: relative;
  padding: 1.1rem 1.2rem 1.2rem;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 0.95rem;
  background: rgba(7, 7, 19, 0.42);
  overflow: hidden;
  backdrop-filter: blur(12px);
}

.workflow-step::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: linear-gradient(180deg, rgba(53, 243, 255, 0.85), rgba(255, 79, 216, 0.6));
  opacity: 0.85;
}

.workflow-index {
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.3em;
  color: rgba(165, 243, 252, 0.8);
}

.workflow-title {
  margin: 0.5rem 0 0.4rem;
  font-size: 1rem;
  font-weight: 900;
  color: white;
}

.workflow-desc {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.6;
  color: rgba(203, 213, 225, 0.82);
}

.feature-card {
  padding: 1.4rem;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 1rem;
  background: rgba(7, 7, 19, 0.5);
  backdrop-filter: blur(14px);
  transition: border-color 200ms ease, transform 200ms ease;
}

.feature-card:hover {
  border-color: rgba(53, 243, 255, 0.5);
  transform: translateY(-2px);
}

.feature-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 0.85rem;
}

.feature-icon-cyan {
  color: rgb(53, 243, 255);
  background: rgba(53, 243, 255, 0.14);
}

.feature-icon-pink {
  color: rgb(255, 79, 216);
  background: rgba(255, 79, 216, 0.14);
}

.feature-icon-violet {
  color: rgb(167, 139, 250);
  background: rgba(167, 139, 250, 0.16);
}

.feature-icon-lime {
  color: rgb(132, 247, 153);
  background: rgba(132, 247, 153, 0.14);
}

.feature-title {
  margin: 1rem 0 0.4rem;
  font-size: 1rem;
  font-weight: 900;
  color: white;
}

.feature-desc {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.6;
  color: rgba(148, 163, 184, 0.9);
}
</style>
