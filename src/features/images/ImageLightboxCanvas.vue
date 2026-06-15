<script setup lang="ts">
import type { ImageRecord } from './image.types';
import { ICONS } from './image-lightbox-icons';
import { useImageSwipeNavigation } from './useImageSwipeNavigation';

const props = defineProps<{
  image?: ImageRecord | null;
  detailsOpen: boolean;
  imageControlsHidden: boolean;
  isPanning: boolean;
  zoomScale: number;
  zoomTransform: string;
  zoomPercent: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  zoomStep: number;
}>();

const emit = defineEmits<{
  imageDoubleClick: [event: MouseEvent];
  imagePointerDown: [event: PointerEvent];
  imagePointerMove: [event: PointerEvent];
  imagePointerUp: [event: PointerEvent];
  imageWheel: [event: WheelEvent];
  next: [];
  prev: [];
  resetZoom: [];
  surface: [];
  toggleControls: [];
  zoomBy: [factor: number];
}>();

const {
  onSwipePointerDown,
  onSwipePointerMove,
  onSwipePointerUp,
  onSwipePointerCancel,
  shouldSuppressClick,
} = useImageSwipeNavigation({
  canSwipe: () => props.zoomScale <= 1 + 1e-3 && !props.isPanning,
  onPrevious: () => emit('prev'),
  onNext: () => emit('next'),
});

const handleImageClick = () => {
  if (shouldSuppressClick()) return;
  emit('toggleControls');
};

const handleImagePointerDown = (event: PointerEvent) => {
  onSwipePointerDown(event);
  emit('imagePointerDown', event);
};

const handleImagePointerMove = (event: PointerEvent) => {
  onSwipePointerMove(event);
  emit('imagePointerMove', event);
};

const handleImagePointerUp = (event: PointerEvent) => {
  onSwipePointerUp(event);
  emit('imagePointerUp', event);
};

const handleImagePointerCancel = (event: PointerEvent) => {
  onSwipePointerCancel(event);
  emit('imagePointerUp', event);
};
</script>

<template>
  <figure class="image-canvas" :class="{ 'has-drawer': detailsOpen }" @click="emit('surface')">
    <img
      v-if="image"
      :src="image.public_url"
      :alt="image.title"
      class="main-image"
      :class="{ 'is-panning': isPanning, 'is-zoomed': zoomScale > 1 }"
      :style="{ transform: zoomTransform }"
      draggable="false"
      @click.stop="handleImageClick"
      @wheel.prevent="emit('imageWheel', $event)"
      @pointerdown="handleImagePointerDown"
      @pointermove="handleImagePointerMove"
      @pointerup="handleImagePointerUp"
      @pointercancel="handleImagePointerCancel"
      @dblclick.stop="emit('imageDoubleClick', $event)"
      @dragstart.prevent
    />
    <figcaption class="sr-only">
      {{ image ? `${image.title} 预览` : '未选中图片，请从图库点击进入' }}
    </figcaption>

    <div v-if="image && !imageControlsHidden" class="image-controls" @click.stop @dblclick.stop>
      <button
        type="button"
        class="image-ctrl-btn"
        aria-label="上一张"
        title="上一张 (←)"
        @click="emit('prev')"
      >
        <svg :viewBox="ICONS.chevronLeft.vb" fill="currentColor" aria-hidden="true">
          <path :d="ICONS.chevronLeft.d" />
        </svg>
      </button>
      <span class="ctrl-divider" aria-hidden="true" />
      <button
        type="button"
        class="image-ctrl-btn"
        :disabled="!canZoomOut"
        aria-label="缩小"
        title="缩小"
        @click="emit('zoomBy', 1 / zoomStep)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
          <path d="M8 11h6" />
        </svg>
      </button>
      <button
        type="button"
        class="image-ctrl-btn ctrl-percent"
        :title="`重置（当前 ${zoomPercent}%）`"
        @click="emit('resetZoom')"
      >
        {{ zoomPercent }}%
      </button>
      <button
        type="button"
        class="image-ctrl-btn"
        :disabled="!canZoomIn"
        aria-label="放大"
        title="放大"
        @click="emit('zoomBy', zoomStep)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
          <path d="M8 11h6" />
          <path d="M11 8v6" />
        </svg>
      </button>
      <span class="ctrl-divider" aria-hidden="true" />
      <button
        type="button"
        class="image-ctrl-btn"
        aria-label="下一张"
        title="下一张 (→)"
        @click="emit('next')"
      >
        <svg :viewBox="ICONS.chevronRight.vb" fill="currentColor" aria-hidden="true">
          <path :d="ICONS.chevronRight.d" />
        </svg>
      </button>
    </div>
  </figure>

  <button type="button" class="nav-arrow nav-arrow-left" aria-label="上一张（←）" @click.stop="emit('prev')">
    <svg :viewBox="ICONS.chevronLeft.vb" fill="currentColor" class="h-5 w-5" aria-hidden="true"><path :d="ICONS.chevronLeft.d" /></svg>
  </button>

  <button type="button" class="nav-arrow nav-arrow-right" aria-label="下一张（→）" @click.stop="emit('next')">
    <svg :viewBox="ICONS.chevronRight.vb" fill="currentColor" class="h-5 w-5" aria-hidden="true"><path :d="ICONS.chevronRight.d" /></svg>
  </button>
</template>

<style scoped src="./image-lightbox.css"></style>
