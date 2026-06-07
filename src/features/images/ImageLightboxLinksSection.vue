<script setup lang="ts">
import { ICONS } from './image-lightbox-icons';
import type { LinkRow } from './image-lightbox-detail-types';

defineProps<{
  linkRows: LinkRow[];
}>();

const emit = defineEmits<{
  copyValue: [value: string, label: string];
}>();
</script>

<template>
  <section class="detail-section">
    <div class="section-title">
      <svg :viewBox="ICONS.link.vb" fill="currentColor" class="section-icon" aria-hidden="true"><path :d="ICONS.link.d" /></svg>
      <span>链接</span>
    </div>
    <div class="detail-items">
      <div v-for="row in linkRows" :key="row.label" class="detail-item is-column">
        <span class="item-label">{{ row.label }}</span>
        <span class="item-value font-mono text-truncate">{{ row.value }}</span>
        <button type="button" class="inline-copy" @click="emit('copyValue', row.value, row.label)">
          复制{{ row.label }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped src="./image-lightbox.css"></style>
