<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { ImageRecord } from './image.types';
import { buildPublicPageUrl } from './image-links';

const props = defineProps<{ open: boolean; image?: ImageRecord | null }>();
const emit = defineEmits<{ close: []; prev: []; next: [] }>();

type IconName =
  | 'close'
  | 'chevronLeft'
  | 'chevronRight'
  | 'download'
  | 'info'
  | 'expand'
  | 'share'
  | 'check'
  | 'panelClose'
  | 'fileAlt'
  | 'robot'
  | 'link'
  | 'clock'
  | 'mapPin';

const ICONS: Record<IconName, { vb: string; d: string }> = {
  close: { vb: '0 0 384 512', d: 'M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z' },
  chevronLeft: { vb: '0 0 320 512', d: 'M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 246.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z' },
  chevronRight: { vb: '0 0 320 512', d: 'M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z' },
  download: { vb: '0 0 512 512', d: 'M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32V274.7l-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7V32zM64 352c-35.3 0-64 28.7-64 64v32c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V416c0-35.3-28.7-64-64-64H346.5l-45.3 45.3c-25 25-65.5 25-90.5 0L165.5 352H64zm368 56a24 24 0 1 1 0 48 24 24 0 1 1 0-48z' },
  info: { vb: '0 0 512 512', d: 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z' },
  expand: { vb: '0 0 512 512', d: 'M344 0H488c13.3 0 24 10.7 24 24V168c0 9.7-5.8 18.5-14.8 22.2s-19.3 1.7-26.2-5.2l-39-39-87 87c-9.4 9.4-24.6 9.4-33.9 0l-32-32c-9.4-9.4-9.4-24.6 0-33.9l87-87L327 41c-6.9-6.9-8.9-17.2-5.2-26.2S334.3 0 344 0zM168 512H24c-13.3 0-24-10.7-24-24V344c0-9.7 5.8-18.5 14.8-22.2s19.3-1.7 26.2 5.2l39 39 87-87c9.4-9.4 24.6-9.4 33.9 0l32 32c9.4 9.4 9.4 24.6 0 33.9l-87 87 39 39c6.9 6.9 8.9 17.2 5.2 26.2s-12.5 14.8-22.2 14.8z' },
  share: { vb: '0 0 448 512', d: 'M352 224c53 0 96-43 96-96s-43-96-96-96s-96 43-96 96c0 4 .2 8 .7 11.9l-94.1 47C145.4 170.2 121.9 160 96 160c-53 0-96 43-96 96s43 96 96 96c25.9 0 49.4-10.2 66.6-26.9l94.1 47c-.5 3.9-.7 7.8-.7 11.9c0 53 43 96 96 96s96-43 96-96s-43-96-96-96c-25.9 0-49.4 10.2-66.6 26.9l-94.1-47c.5-3.9 .7-7.8 .7-11.9s-.2-8-.7-11.9l94.1-47C302.6 213.8 326.1 224 352 224z' },
  check: { vb: '0 0 448 512', d: 'M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z' },
  panelClose: { vb: '0 0 320 512', d: 'M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z' },
  fileAlt: { vb: '0 0 384 512', d: 'M0 64C0 28.7 28.7 0 64 0H224V128c0 17.7 14.3 32 32 32H384V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V64zm384 64H256V0L384 128z' },
  robot: { vb: '0 0 640 512', d: 'M320 0c17.7 0 32 14.3 32 32V64H472c39.8 0 72 32.2 72 72V392c0 39.8-32.2 72-72 72H168c-39.8 0-72-32.2-72-72V136c0-39.8 32.2-72 72-72H288V32c0-17.7 14.3-32 32-32zM208 384c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H208zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H304zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H400zM264 256a40 40 0 1 0 -80 0 40 40 0 1 0 80 0zm152 40a40 40 0 1 0 0-80 40 40 0 1 0 0 80zM48 224H64V416H48c-26.5 0-48-21.5-48-48V272c0-26.5 21.5-48 48-48zm544 0c26.5 0 48 21.5 48 48v96c0 26.5-21.5 48-48 48H576V224h16z' },
  link: { vb: '0 0 640 512', d: 'M579.8 267.7c56.5-56.5 56.5-148 0-204.5c-50-50-128.8-56.5-186.3-15.4l-1.6 1.1c-14.4 10.3-17.7 30.3-7.4 44.6s30.3 17.7 44.6 7.4l1.6-1.1c32.1-22.9 76-19.3 103.8 8.6c31.5 31.5 31.5 82.5 0 114L422.3 334.8c-31.5 31.5-82.5 31.5-114 0c-27.9-27.9-31.5-71.8-8.6-103.8l1.1-1.6c10.3-14.4 6.9-34.4-7.4-44.6s-34.4-6.9-44.6 7.4l-1.1 1.6C206.5 251.2 213 330 263 380c56.5 56.5 148 56.5 204.5 0L579.8 267.7zM60.2 244.3c-56.5 56.5-56.5 148 0 204.5c50 50 128.8 56.5 186.3 15.4l1.6-1.1c14.4-10.3 17.7-30.3 7.4-44.6s-30.3-17.7-44.6-7.4l-1.6 1.1c-32.1 22.9-76 19.3-103.8-8.6C74 372 74 321 105.5 289.5L217.7 177.2c31.5-31.5 82.5-31.5 114 0c27.9 27.9 31.5 71.8 8.6 103.9l-1.1 1.6c-10.3 14.4-6.9 34.4 7.4 44.6s34.4 6.9 44.6-7.4l1.1-1.6C433.5 260.8 427 182 377 132c-56.5-56.5-148-56.5-204.5 0L60.2 244.3z' },
  clock: { vb: '0 0 512 512', d: 'M256 0a256 256 0 1 1 0 512A256 256 0 1 1 256 0zM232 120V256c0 8 4 15.5 10.7 20l96 64c11 7.4 25.9 4.4 33.3-6.7s4.4-25.9-6.7-33.3L280 243.2V120c0-13.3-10.7-24-24-24s-24 10.7-24 24z' },
  mapPin: { vb: '0 0 384 512', d: 'M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0zM192 128a64 64 0 1 1 0 128 64 64 0 1 1 0-128z' },
};

const copied = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | null = null;

const detailsOpen = ref(false);

const meta = computed(() => {
  if (!props.image) return '';
  return `${props.image.width} × ${props.image.height} · ${props.image.format.toUpperCase()}`;
});

const publicPageUrl = computed(() => {
  if (!props.image) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return buildPublicPageUrl(props.image, origin);
});

const sharePage = async () => {
  if (!props.image) return;
  try {
    await navigator.clipboard.writeText(publicPageUrl.value);
  } catch {
    return;
  }
  copied.value = true;
  if (copyTimer) clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    copied.value = false;
  }, 1400);
};

const toggleDetails = () => {
  detailsOpen.value = !detailsOpen.value;
};

const handleKey = (e: KeyboardEvent) => {
  if (!props.open) return;
  if (e.key === 'Escape') {
    if (detailsOpen.value) {
      detailsOpen.value = false;
      return;
    }
    emit('close');
  }
  if (e.key === 'ArrowLeft') emit('prev');
  if (e.key === 'ArrowRight') emit('next');
  if (e.key === 'i' || e.key === 'I') toggleDetails();
};

watch(
  () => props.open,
  (open) => {
    if (open) {
      window.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    } else {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
      copied.value = false;
      detailsOpen.value = false;
      if (copyTimer) {
        clearTimeout(copyTimer);
        copyTimer = null;
      }
    }
  },
  { immediate: true },
);

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
          <header class="z-20 flex h-16 items-center justify-between px-4 sm:px-6">
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-white">
                {{ image?.title || '未选中图片' }}
              </p>
              <p class="mt-0.5 truncate text-xs text-slate-400">
                <template v-if="meta">{{ meta }}</template>
                <template v-else>选中图片后展示尺寸信息</template>
                <span v-if="copied" class="ml-2 font-semibold text-neon-lime">分享链接已复制</span>
              </p>
            </div>

            <div class="flex items-center gap-1">
              <button
                type="button"
                class="viewer-btn"
                :class="{ 'is-success': copied }"
                :aria-label="copied ? '分享链接已复制' : '复制分享链接'"
                :disabled="!image"
                @click="sharePage"
              >
                <svg
                  :viewBox="copied ? ICONS.check.vb : ICONS.share.vb"
                  fill="currentColor"
                  class="h-4 w-4"
                  aria-hidden="true"
                >
                  <path :d="copied ? ICONS.check.d : ICONS.share.d" />
                </svg>
              </button>
              <button
                type="button"
                class="viewer-btn"
                :class="{ 'is-active': detailsOpen }"
                :aria-label="detailsOpen ? '关闭详情面板' : '查看详情（i）'"
                :disabled="!image"
                @click="toggleDetails"
              >
                <svg :viewBox="ICONS.info.vb" fill="currentColor" class="h-4 w-4" aria-hidden="true"><path :d="ICONS.info.d" /></svg>
              </button>
              <button type="button" class="viewer-btn" aria-label="下载原图（阶段 9 接入）" disabled>
                <svg :viewBox="ICONS.download.vb" fill="currentColor" class="h-4 w-4" aria-hidden="true"><path :d="ICONS.download.d" /></svg>
              </button>
              <button type="button" class="viewer-btn" aria-label="全屏（阶段 7 接入）" disabled>
                <svg :viewBox="ICONS.expand.vb" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true"><path :d="ICONS.expand.d" /></svg>
              </button>
              <button type="button" class="viewer-btn" aria-label="关闭（ESC）" @click="emit('close')">
                <svg :viewBox="ICONS.close.vb" fill="currentColor" class="h-4 w-4" aria-hidden="true"><path :d="ICONS.close.d" /></svg>
              </button>
            </div>
          </header>

          <div class="relative flex flex-1 items-center justify-center overflow-hidden">
            <figure class="absolute inset-0 z-0 flex items-center justify-center">
              <div class="absolute inset-0 bg-panel/40" />
              <div class="absolute inset-0 bg-gradient-to-br from-neon-cyan/10 via-transparent to-neon-pink/10" />
              <div class="absolute inset-0 bg-grid bg-[length:64px_64px] opacity-30" />
              <img
                v-if="image"
                :src="image.public_url"
                :alt="image.title"
                class="relative z-10 max-h-full max-w-full object-contain"
              />
              <figcaption class="sr-only">
                {{ image ? `${image.title} 预览` : '未选中图片，请从图库点击进入' }}
              </figcaption>
            </figure>

            <button type="button" class="nav-arrow left-4 sm:left-6" aria-label="上一张（←）" @click.stop="emit('prev')">
              <svg :viewBox="ICONS.chevronLeft.vb" fill="currentColor" class="h-5 w-5" aria-hidden="true"><path :d="ICONS.chevronLeft.d" /></svg>
            </button>

            <button type="button" class="nav-arrow right-4 sm:right-6" aria-label="下一张（→）" @click.stop="emit('next')">
              <svg :viewBox="ICONS.chevronRight.vb" fill="currentColor" class="h-5 w-5" aria-hidden="true"><path :d="ICONS.chevronRight.d" /></svg>
            </button>

            <aside
              class="drawer-panel"
              :class="{ 'is-open': detailsOpen }"
              aria-label="图片详情"
              @click.stop
            >
              <header class="drawer-header">
                <span class="drawer-title">详情</span>
                <button
                  type="button"
                  class="viewer-btn"
                  aria-label="收起详情面板"
                  @click="toggleDetails"
                >
                  <svg :viewBox="ICONS.panelClose.vb" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true"><path :d="ICONS.panelClose.d" /></svg>
                </button>
              </header>

              <div v-if="image" class="drawer-content">
                <section class="detail-section">
                  <div class="section-title">
                    <svg :viewBox="ICONS.fileAlt.vb" fill="currentColor" class="section-icon" aria-hidden="true"><path :d="ICONS.fileAlt.d" /></svg>
                    <span>基本信息</span>
                  </div>
                  <div class="detail-items">
                    <div class="detail-item">
                      <span class="item-label">文件名</span>
                      <span class="item-value text-truncate">{{ image.title || image.key }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="item-label">文件大小</span>
                      <span class="item-value text-muted">—</span>
                    </div>
                    <div class="detail-item">
                      <span class="item-label">分辨率</span>
                      <span class="item-value">
                        <span class="badge">{{ image.width }} × {{ image.height }}</span>
                      </span>
                    </div>
                    <div class="detail-item">
                      <span class="item-label">格式</span>
                      <span class="item-value">
                        <span class="badge">{{ image.format.toUpperCase() }}</span>
                      </span>
                    </div>
                    <div class="detail-item">
                      <span class="item-label">访问级别</span>
                      <span class="item-value">
                        <span class="badge badge-lime">公开</span>
                      </span>
                    </div>
                    <div class="detail-item">
                      <span class="item-label">存储时长</span>
                      <span class="item-value text-muted">永久</span>
                    </div>
                  </div>
                </section>

                <section v-if="image.location_name" class="detail-section">
                  <div class="section-title">
                    <svg :viewBox="ICONS.mapPin.vb" fill="currentColor" class="section-icon" aria-hidden="true"><path :d="ICONS.mapPin.d" /></svg>
                    <span>位置</span>
                  </div>
                  <div class="detail-items">
                    <div class="detail-item">
                      <span class="item-label">地名</span>
                      <span class="item-value text-truncate">{{ image.location_name }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="item-label">坐标</span>
                      <span class="item-value text-muted">阶段 11 接入</span>
                    </div>
                  </div>
                </section>

                <section class="detail-section">
                  <div class="section-title">
                    <svg :viewBox="ICONS.robot.vb" fill="currentColor" class="section-icon" aria-hidden="true"><path :d="ICONS.robot.d" /></svg>
                    <span>AI 分析</span>
                  </div>
                  <div class="detail-items">
                    <div class="detail-item is-column">
                      <span class="item-label">描述</span>
                      <p v-if="image.caption" class="item-description">{{ image.caption }}</p>
                      <p v-else class="item-description text-muted">阶段 10 接入 AI 描述</p>
                    </div>
                    <div class="detail-item">
                      <span class="item-label">内容安全</span>
                      <span class="item-value">
                        <span class="badge badge-muted">未评估</span>
                      </span>
                    </div>
                  </div>
                </section>

                <section class="detail-section">
                  <div class="section-title">
                    <svg :viewBox="ICONS.link.vb" fill="currentColor" class="section-icon" aria-hidden="true"><path :d="ICONS.link.d" /></svg>
                    <span>链接</span>
                  </div>
                  <div class="detail-items">
                    <div class="detail-item is-column">
                      <span class="item-label">完整链接</span>
                      <span class="item-value font-mono text-truncate">{{ image.public_url }}</span>
                    </div>
                    <div class="detail-item is-column">
                      <span class="item-label">分享页</span>
                      <span class="item-value font-mono text-truncate">{{ publicPageUrl }}</span>
                    </div>
                    <div class="detail-item is-column">
                      <span class="item-label">缩略图链接</span>
                      <span class="item-value text-muted">阶段 12 接入</span>
                    </div>
                  </div>
                </section>

                <section class="detail-section">
                  <div class="section-title">
                    <svg :viewBox="ICONS.clock.vb" fill="currentColor" class="section-icon" aria-hidden="true"><path :d="ICONS.clock.d" /></svg>
                    <span>时间</span>
                  </div>
                  <div class="detail-items">
                    <div class="detail-item">
                      <span class="item-label">创建时间</span>
                      <span class="item-value text-muted">阶段 11 接入</span>
                    </div>
                    <div class="detail-item">
                      <span class="item-label">更新时间</span>
                      <span class="item-value text-muted">阶段 11 接入</span>
                    </div>
                  </div>
                </section>
              </div>
            </aside>
          </div>

          <footer class="z-10 flex h-12 items-center justify-center gap-3 px-4 font-mono text-[11px] text-slate-500 sm:px-6">
            <span>I 切换详情</span>
            <span class="text-slate-700">·</span>
            <span>← → 翻页（阶段 7 索引接入）</span>
            <span class="text-slate-700">·</span>
            <span>ESC 关闭</span>
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
.viewer-btn.is-success {
  color: rgb(132, 247, 153);
  background: rgba(132, 247, 153, 0.12);
}
.viewer-btn.is-active {
  color: rgb(53, 243, 255);
  background: rgba(53, 243, 255, 0.12);
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

.drawer-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 420px;
  background: rgba(7, 7, 19, 0.98);
  backdrop-filter: blur(24px);
  border-left: 1px solid rgba(53, 243, 255, 0.18);
  transform: translateX(100%);
  transition: transform 0.3s ease;
  z-index: 15;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: -8px 0 30px rgba(0, 0, 0, 0.55);
}
.drawer-panel.is-open {
  transform: translateX(0);
}
@media (max-width: 640px) {
  .drawer-panel {
    width: 100%;
  }
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(53, 243, 255, 0.12);
  flex-shrink: 0;
}
.drawer-title {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: rgb(53, 243, 255);
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.detail-section {
  margin-bottom: 20px;
  padding: 14px;
  border: 1px solid rgba(53, 243, 255, 0.2);
  border-radius: 6px;
  background: rgba(15, 20, 25, 0.35);
}
.detail-section:last-child {
  margin-bottom: 0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 10px;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(53, 243, 255, 0.15);
  font-size: 13px;
  font-weight: 700;
  color: rgb(165, 243, 252);
}
.section-icon {
  width: 14px;
  height: 14px;
  color: rgb(103, 232, 249);
  flex-shrink: 0;
}

.detail-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  background: rgba(7, 7, 19, 0.55);
  border: 1px solid rgba(53, 243, 255, 0.1);
  border-radius: 4px;
}
.detail-item.is-column {
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}

.item-label {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: rgba(103, 232, 249, 0.75);
}
.item-value {
  font-size: 12px;
  font-weight: 500;
  color: rgb(229, 231, 235);
  min-width: 0;
}
.detail-item:not(.is-column) .item-value {
  text-align: right;
}
.item-description {
  font-size: 12.5px;
  line-height: 1.65;
  color: rgb(203, 213, 225);
  margin: 0;
}
.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}
.font-mono {
  font-family: 'Menlo', 'Consolas', 'Courier New', monospace;
}
.text-muted {
  color: rgba(148, 163, 184, 0.7);
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 11px;
  color: rgb(53, 243, 255);
  background: rgba(53, 243, 255, 0.1);
  border: 1px solid rgba(53, 243, 255, 0.25);
  border-radius: 4px;
}
.badge.badge-lime {
  color: rgb(132, 247, 153);
  background: rgba(132, 247, 153, 0.1);
  border-color: rgba(132, 247, 153, 0.3);
}
.badge.badge-muted {
  color: rgba(148, 163, 184, 0.85);
  background: rgba(148, 163, 184, 0.08);
  border-color: rgba(148, 163, 184, 0.2);
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
