<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: []; prev: []; next: [] }>();

type IconName = 'close' | 'chevronLeft' | 'chevronRight' | 'download' | 'info' | 'expand';

const ICONS: Record<IconName, { vb: string; d: string }> = {
  close: { vb: '0 0 384 512', d: 'M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z' },
  chevronLeft: { vb: '0 0 320 512', d: 'M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 246.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z' },
  chevronRight: { vb: '0 0 320 512', d: 'M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z' },
  download: { vb: '0 0 512 512', d: 'M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32V274.7l-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7V32zM64 352c-35.3 0-64 28.7-64 64v32c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V416c0-35.3-28.7-64-64-64H346.5l-45.3 45.3c-25 25-65.5 25-90.5 0L165.5 352H64zm368 56a24 24 0 1 1 0 48 24 24 0 1 1 0-48z' },
  info: { vb: '0 0 512 512', d: 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z' },
  expand: { vb: '0 0 512 512', d: 'M344 0H488c13.3 0 24 10.7 24 24V168c0 9.7-5.8 18.5-14.8 22.2s-19.3 1.7-26.2-5.2l-39-39-87 87c-9.4 9.4-24.6 9.4-33.9 0l-32-32c-9.4-9.4-9.4-24.6 0-33.9l87-87L327 41c-6.9-6.9-8.9-17.2-5.2-26.2S334.3 0 344 0zM168 512H24c-13.3 0-24-10.7-24-24V344c0-9.7 5.8-18.5 14.8-22.2s19.3-1.7 26.2 5.2l39 39 87-87c9.4-9.4 24.6-9.4 33.9 0l32 32c9.4 9.4 9.4 24.6 0 33.9l-87 87 39 39c6.9 6.9 8.9 17.2 5.2 26.2s-12.5 14.8-22.2 14.8z' },
};

const handleKey = (e: KeyboardEvent) => {
  if (!props.open) return;
  if (e.key === 'Escape') emit('close');
  if (e.key === 'ArrowLeft') emit('prev');
  if (e.key === 'ArrowRight') emit('next');
};

watch(() => props.open, (open) => {
  if (open) {
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
  } else {
    window.removeEventListener('keydown', handleKey);
    document.body.style.overflow = '';
  }
}, { immediate: true });

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKey);
  document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <Transition name="lightbox">
      <div v-if="open" class="fixed inset-0 z-[9000]">
        <div class="absolute inset-0 bg-void/95 backdrop-blur-xl" @click="emit('close')" aria-hidden="true" />

        <div class="relative flex h-full w-full flex-col">
          <header class="z-10 flex h-16 items-center justify-between px-4 sm:px-6">
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-white">公开图片标题</p>
              <p class="mt-0.5 text-xs text-slate-400">2560 × 1536 · 4.2 MB · WebP</p>
            </div>

            <div class="flex items-center gap-1">
              <button type="button" class="viewer-btn" aria-label="下载原图（阶段 9 接入）" disabled>
                <svg :viewBox="ICONS.download.vb" fill="currentColor" class="h-4 w-4" aria-hidden="true"><path :d="ICONS.download.d" /></svg>
              </button>
              <button type="button" class="viewer-btn" aria-label="详情（阶段 5 接入）" disabled>
                <svg :viewBox="ICONS.info.vb" fill="currentColor" class="h-4 w-4" aria-hidden="true"><path :d="ICONS.info.d" /></svg>
              </button>
              <button type="button" class="viewer-btn" aria-label="全屏（阶段 7 接入）" disabled>
                <svg :viewBox="ICONS.expand.vb" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true"><path :d="ICONS.expand.d" /></svg>
              </button>
              <button type="button" class="viewer-btn" aria-label="关闭" @click="emit('close')">
                <svg :viewBox="ICONS.close.vb" fill="currentColor" class="h-4 w-4" aria-hidden="true"><path :d="ICONS.close.d" /></svg>
              </button>
            </div>
          </header>

          <div class="relative flex flex-1 items-center justify-center overflow-hidden">
            <figure class="absolute inset-0 z-0">
              <div class="absolute inset-0 bg-panel/40" />
              <div class="absolute inset-0 bg-gradient-to-br from-neon-cyan/10 via-transparent to-neon-pink/10" />
              <div class="absolute inset-0 bg-grid bg-[length:64px_64px] opacity-30" />
              <figcaption class="sr-only">公开图片预览占位（阶段 5 接入真实图后改为居中 object-contain）</figcaption>
            </figure>

            <button type="button" class="nav-arrow left-4 sm:left-6" aria-label="上一张" @click.stop="emit('prev')">
              <svg :viewBox="ICONS.chevronLeft.vb" fill="currentColor" class="h-5 w-5" aria-hidden="true"><path :d="ICONS.chevronLeft.d" /></svg>
            </button>

            <button type="button" class="nav-arrow right-4 sm:right-6" aria-label="下一张" @click.stop="emit('next')">
              <svg :viewBox="ICONS.chevronRight.vb" fill="currentColor" class="h-5 w-5" aria-hidden="true"><path :d="ICONS.chevronRight.d" /></svg>
            </button>
          </div>

          <footer class="z-10 flex h-16 items-center justify-center gap-3 px-4 text-xs font-mono text-slate-300 sm:px-6">
            <span>1 / 24</span>
            <span class="text-slate-600">·</span>
            <span class="text-slate-500">缩放、旋转、适配等控件待阶段 7 接入</span>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.viewer-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 0.5rem;
  color: rgb(203, 213, 225);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}
.viewer-btn:hover:not(:disabled) {
  background: rgba(53, 243, 255, 0.1);
  color: rgb(53, 243, 255);
}
.viewer-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.nav-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 9999px;
  background: rgba(7, 7, 19, 0.85);
  border: 1px solid rgba(53, 243, 255, 0.25);
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: all 0.2s ease;
  z-index: 10;
}
.nav-arrow:hover {
  border-color: rgba(53, 243, 255, 0.6);
  color: rgb(53, 243, 255);
  transform: translateY(-50%) scale(1.05);
  box-shadow: 0 4px 20px rgba(53, 243, 255, 0.25);
}

.lightbox-enter-active,
.lightbox-leave-active {
  transition: all 0.25s ease;
}
.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
</style>
