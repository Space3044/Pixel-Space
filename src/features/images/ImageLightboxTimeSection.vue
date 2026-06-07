<script setup lang="ts">
import { ICONS } from './image-lightbox-icons';
import type { ImageRecord } from './image.types';

defineProps<{
  image: ImageRecord;
  formatImageTimestamp: (value: string | null | undefined) => string;
}>();
</script>

<template>
  <section class="detail-section">
    <div class="section-title">
      <svg :viewBox="ICONS.clock.vb" fill="currentColor" class="section-icon" aria-hidden="true"><path :d="ICONS.clock.d" /></svg>
      <span>时间</span>
    </div>
    <div class="detail-items">
      <div class="detail-item">
        <span class="item-label">创建时间</span>
        <span class="item-value">{{ formatImageTimestamp(image.created_at) }}</span>
      </div>
      <div class="detail-item">
        <span class="item-label">更新时间</span>
        <span class="item-value">{{ formatImageTimestamp(image.updated_at) }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped src="./image-lightbox.css"></style>
