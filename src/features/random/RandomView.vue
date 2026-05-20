<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import AppShell from '@/shared/ui/AppShell.vue';
// 阶段 5/8 增强：调用 GET /api/random 拿一张图，填到 imageData
// 阶段 10：详情卡片接 AI 描述、标签等字段

const loading = ref(false);

const ROTATE = { vb: '0 0 512 512', d: 'M105.1 202.6c7.7-21.8 20.2-42.3 37.8-59.8c62.5-62.5 163.8-62.5 226.3 0L386.3 160H352c-17.7 0-32 14.3-32 32s14.3 32 32 32H463.5c0 0 0 0 0 0h.4c17.7 0 32-14.3 32-32V80c0-17.7-14.3-32-32-32s-32 14.3-32 32v35.2L414.4 97.6c-87.5-87.5-229.3-87.5-316.8 0C73.2 122 55.6 150.7 44.8 181.4c-5.9 16.7 2.9 34.9 19.5 40.8s34.9-2.9 40.8-19.5zM39 289.3c-5 1.5-9.8 4.2-13.7 8.2c-4 4-6.7 8.8-8.1 14c-.3 1.2-.6 2.5-.8 3.8c-.3 1.7-.4 3.4-.4 5.1V432c0 17.7 14.3 32 32 32s32-14.3 32-32V396.9l17.6 17.5 0 0c87.5 87.4 229.3 87.4 316.7 0c24.4-24.4 42.1-53.1 52.9-83.7c5.9-16.7-2.9-34.9-19.5-40.8s-34.9 2.9-40.8 19.5c-7.7 21.8-20.2 42.3-37.8 59.8c-62.5 62.5-163.8 62.5-226.3 0l-.1-.1L125.6 352H160c17.7 0 32-14.3 32-32s-14.3-32-32-32H48.4c-1.6 0-3.2 .1-4.8 .3s-3.1 .5-4.6 1z' };
const CHEVRON_UP = { vb: '0 0 512 512', d: 'M233.4 105.4c12.5-12.5 32.8-12.5 45.3 0l192 192c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L256 173.3 86.6 342.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l192-192z' };

const refresh = () => {
  if (loading.value) return;
  loading.value = true;
  // 阶段 5 接入真实 API：调用 GET /api/random，把返回 URL 喂给图片元素
  setTimeout(() => { loading.value = false; }, 500);
};

const handleKey = (e: KeyboardEvent) => {
  const tag = (document.activeElement?.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    refresh();
  }
};

onMounted(() => window.addEventListener('keydown', handleKey));
onUnmounted(() => window.removeEventListener('keydown', handleKey));
</script>

<template>
  <AppShell fluid>
    <div class="-mx-3 -mt-16 sm:-mx-4">
      <section class="relative h-screen overflow-hidden">
        <figure
          class="absolute inset-0 transition-opacity duration-500"
          :class="loading ? 'opacity-30' : 'opacity-100'"
        >
          <div class="absolute inset-0 bg-panel/40" />
          <div class="absolute inset-0 bg-gradient-to-br from-neon-cyan/10 via-transparent to-neon-pink/10" />
          <div class="absolute inset-0 bg-grid bg-[length:64px_64px] opacity-30" />
          <figcaption class="sr-only">随机推荐图片占位（阶段 5 接入真实图后改为 object-cover 满屏渲染）</figcaption>
        </figure>

        <div aria-hidden="true" class="pointer-events-none absolute inset-0 -z-10">
          <div class="absolute -top-32 left-1/3 h-80 w-80 rounded-full bg-neon-cyan/15 blur-3xl" />
          <div class="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-neon-pink/15 blur-3xl" />
        </div>

        <div class="pointer-events-none absolute bottom-8 left-1/2 z-20 -translate-x-1/2 animate-bounce text-center text-xs font-medium tracking-wide text-slate-300 [text-shadow:0_2px_8px_rgba(0,0,0,0.6)]">
          <svg :viewBox="CHEVRON_UP.vb" fill="currentColor" class="mx-auto h-5 w-5 rotate-180 opacity-80" aria-hidden="true"><path :d="CHEVRON_UP.d" /></svg>
          <span class="mt-1 block">向下滚动查看详情</span>
        </div>
      </section>

      <section class="relative z-10 mx-auto max-w-[1600px] border-t border-neon-cyan/15 bg-void/60 px-4 py-8 backdrop-blur-2xl sm:px-6">
        <header class="mb-6 space-y-1 px-1">
          <p class="text-xs font-bold uppercase tracking-[0.3em] text-neon-cyan">Random</p>
          <h1 class="text-2xl font-black text-white sm:text-3xl">随机一刻</h1>
        </header>

        <div class="grid gap-6 lg:grid-cols-3">
          <article class="cyber-panel rounded-2xl p-6">
            <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-neon-cyan">
              <span class="inline-block h-1.5 w-1.5 rounded-full bg-neon-cyan" />
              <span>Uploader</span>
            </div>
            <p class="mt-4 text-base font-bold text-white">作者信息待阶段 6 接入</p>
            <p class="mt-2 text-sm text-slate-400">个人图床场景下大概率只有「站长本人」，等接 Cloudflare Access 后写死即可。</p>
          </article>

          <article class="cyber-panel rounded-2xl p-6">
            <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-neon-pink">
              <span class="inline-block h-1.5 w-1.5 rounded-full bg-neon-pink" />
              <span>AI Analysis</span>
            </div>
            <p class="mt-4 text-base font-bold text-white">AI 描述、标签待阶段 10 接入</p>
            <p class="mt-2 text-sm text-slate-400">读取 D1 中 <code class="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs">caption</code> / <code class="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs">tags_json</code> 字段，未生成时显示 pending。</p>
          </article>

          <article class="cyber-panel rounded-2xl p-6">
            <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.3em] text-neon-violet">
              <span class="inline-block h-1.5 w-1.5 rounded-full bg-neon-violet" />
              <span>File Detail</span>
            </div>
            <dl class="mt-4 space-y-2 text-sm">
              <div class="flex justify-between text-slate-400"><dt>尺寸</dt><dd class="font-mono text-slate-200">--</dd></div>
              <div class="flex justify-between text-slate-400"><dt>大小</dt><dd class="font-mono text-slate-200">--</dd></div>
              <div class="flex justify-between text-slate-400"><dt>格式</dt><dd class="font-mono text-slate-200">--</dd></div>
              <div class="flex justify-between text-slate-400"><dt>位置</dt><dd class="font-mono text-slate-200">--</dd></div>
            </dl>
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
.refresh-btn {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 9999px;
  background: rgba(53, 243, 255, 0.1);
  color: rgb(53, 243, 255);
  border: 1px solid rgba(53, 243, 255, 0.3);
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  cursor: pointer;
}
.refresh-btn:hover:not(:disabled) {
  transform: scale(1.08);
  background: rgba(53, 243, 255, 0.2);
  box-shadow: 0 4px 18px rgba(53, 243, 255, 0.3);
}
.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.hint-card {
  position: fixed;
  bottom: 1.5rem;
  left: 1.5rem;
  z-index: 30;
  display: flex;
  flex-direction: column;
  padding: 0.5rem 0.75rem;
  background: rgba(7, 7, 19, 0.5);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(53, 243, 255, 0.2);
  border-radius: 0.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
.hint-card kbd {
  display: inline-block;
  min-width: 1.2rem;
  padding: 0.1rem 0.3rem;
  font-family: 'Courier New', monospace;
  font-size: 0.6rem;
  color: rgb(53, 243, 255);
  background: rgba(53, 243, 255, 0.1);
  border: 1px solid rgba(53, 243, 255, 0.3);
  border-radius: 0.25rem;
  text-align: center;
}

@media (max-width: 768px) {
  .refresh-btn { bottom: 1rem; right: 1rem; width: 40px; height: 40px; }
  .hint-card { bottom: 1rem; left: 1rem; }
}
</style>
