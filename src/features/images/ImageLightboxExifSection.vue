<script setup lang="ts">
import { ICONS } from './image-lightbox-icons';
import type { DetailRow } from './image-lightbox-detail-types';

defineProps<{
  exifRows: DetailRow[];
}>();
</script>

<template>
  <section class="detail-section">
    <div class="section-title">
      <svg :viewBox="ICONS.clock.vb" fill="currentColor" class="section-icon" aria-hidden="true"><path :d="ICONS.clock.d" /></svg>
      <span>EXIF</span>
    </div>
    <div class="exif-grid">
      <div
        v-for="row in exifRows"
        :key="row.label"
        class="detail-item exif-item"
        :class="{ 'is-full': row.span === 'full' }"
      >
        <span class="item-label">{{ row.label }}</span>
        <span class="item-value" :class="{ 'text-muted': row.muted }">{{ row.value }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped src="./image-lightbox.css"></style>
