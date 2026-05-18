<script setup lang="ts">
import AppShell from '@/shared/ui/AppShell.vue';
// 阶段 7：接入 exifr 解析非 GPS EXIF + browser-image-compression 压缩为 WebP
// 阶段 8：组装 FormData 调用 POST /api/upload，逐张提交或并行批量
// 多图上传：每张图独立标题、描述；切换缩略图时主预览、EXIF、表单一并切换
</script>

<template>
  <AppShell fluid>
    <div class="-mx-3 -mt-16 sm:-mx-4">
      <section class="upload-stage">
        <div aria-hidden="true" class="orbs">
          <div class="orb orb-cyan" />
          <div class="orb orb-pink" />
        </div>

        <div class="upload-canvas">
          <div class="cyber-panel flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 p-8 text-center sm:flex-row sm:gap-4">
            <p class="text-base font-bold text-white">拖拽图片到此或点击选择</p>
            <span class="hidden text-xs text-slate-400 sm:inline">·</span>
            <p class="text-xs text-slate-400">阶段 7 接入 exifr + browser-image-compression</p>
          </div>

          <div class="workbench">
            <aside class="queue-rail cyber-panel rounded-2xl p-3">
              <header class="mb-3 flex items-center justify-between px-1">
                <p class="text-[10px] font-bold uppercase tracking-[0.25em] text-neon-cyan">Queue</p>
                <span class="text-[10px] text-slate-500">0 张</span>
              </header>
              <div class="queue-list">
                <button type="button" class="thumb is-active" disabled>
                  <span class="sr-only">当前选中缩略图占位</span>
                </button>
                <button type="button" class="thumb" disabled>
                  <span class="sr-only">缩略图占位</span>
                </button>
                <button type="button" class="thumb" disabled>
                  <span class="sr-only">缩略图占位</span>
                </button>
                <button type="button" class="thumb" disabled>
                  <span class="sr-only">缩略图占位</span>
                </button>
              </div>
            </aside>

            <figure class="preview-stage cyber-panel overflow-hidden rounded-[2rem]">
              <div class="absolute inset-0 bg-panel/40" />
              <div class="absolute inset-0 bg-gradient-to-br from-neon-cyan/10 via-transparent to-neon-pink/10" />
              <div class="absolute inset-0 bg-grid bg-[length:64px_64px] opacity-25" />
              <figcaption class="sr-only">当前选中图片预览占位</figcaption>
            </figure>

            <aside class="meta-sidebar cyber-panel space-y-5 rounded-[2rem] p-6">
              <div>
                <p class="text-xs font-bold uppercase tracking-[0.3em] text-neon-cyan">EXIF</p>
                <dl class="mt-3 space-y-2 text-sm">
                  <div class="flex justify-between text-slate-300">
                    <dt>ISO</dt>
                    <dd class="font-mono text-slate-500">--</dd>
                  </div>
                  <div class="flex justify-between text-slate-300">
                    <dt>快门</dt>
                    <dd class="font-mono text-slate-500">--</dd>
                  </div>
                  <div class="flex justify-between text-slate-300">
                    <dt>光圈</dt>
                    <dd class="font-mono text-slate-500">--</dd>
                  </div>
                </dl>
              </div>

              <div class="space-y-4 border-t border-white/10 pt-5">
                <p class="text-xs font-bold uppercase tracking-[0.3em] text-neon-pink">当前图片信息</p>
                <label class="block space-y-1">
                  <span class="text-sm font-semibold text-slate-300">标题</span>
                  <input type="text" class="cyber-input" disabled />
                </label>
                <label class="block space-y-1">
                  <span class="text-sm font-semibold text-slate-300">描述</span>
                  <textarea rows="3" class="cyber-input" disabled></textarea>
                </label>
                <label class="block space-y-1">
                  <span class="text-sm font-semibold text-slate-300">位置</span>
                  <input type="text" class="cyber-input" placeholder="例如：上海 外滩" disabled />
                </label>
              </div>
            </aside>
          </div>

          <footer class="flex items-center justify-end gap-3 pt-2">
            <span class="text-sm text-slate-500">等待选择图片</span>
            <button type="button" class="cyber-button" disabled>开始上传</button>
          </footer>
        </div>
      </section>
    </div>
  </AppShell>
</template>

<style scoped>
.upload-stage {
  position: relative;
  min-height: 100vh;
  background: linear-gradient(135deg, #04040c 0%, #070713 50%, #0a0a1a 100%);
  overflow: hidden;
}

.orbs {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.orb {
  position: absolute;
  width: 24rem;
  height: 24rem;
  border-radius: 9999px;
  filter: blur(80px);
  opacity: 0.18;
}

.orb-cyan {
  top: -6rem;
  left: -4rem;
  background: rgb(53, 243, 255);
}

.orb-pink {
  bottom: -6rem;
  right: -4rem;
  background: rgb(255, 79, 216);
}

.upload-canvas {
  position: relative;
  z-index: 1;
  max-width: 1600px;
  margin: 0 auto;
  padding: 5rem 1.5rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

@media (min-width: 640px) {
  .upload-canvas {
    padding: 5rem 2rem 3rem;
  }
}

.workbench {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: 1fr;
  align-items: stretch;
}

@media (min-width: 1024px) {
  .workbench {
    grid-template-columns: 7rem minmax(0, 1fr) 22rem;
  }
}

.queue-rail {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.queue-list {
  display: flex;
  flex-direction: row;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

@media (min-width: 1024px) {
  .queue-list {
    flex-direction: column;
    overflow-x: visible;
    overflow-y: auto;
    max-height: calc(100vh - 20rem);
    padding-right: 0.25rem;
  }
}

.thumb {
  flex: 0 0 4.5rem;
  aspect-ratio: 1 / 1;
  width: 4.5rem;
  border-radius: 0.75rem;
  background: rgba(7, 7, 19, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
  cursor: pointer;
}

.thumb:hover:not(:disabled) {
  border-color: rgba(53, 243, 255, 0.3);
  transform: translateY(-1px);
}

.thumb.is-active {
  border-color: rgb(53, 243, 255);
  box-shadow: 0 0 12px rgba(53, 243, 255, 0.4);
}

.thumb:disabled {
  cursor: not-allowed;
}

.preview-stage {
  position: relative;
  min-height: 28rem;
}

@media (min-width: 1024px) {
  .preview-stage {
    min-height: 32rem;
  }
}
</style>
