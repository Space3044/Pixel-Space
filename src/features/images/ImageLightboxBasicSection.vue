<script setup lang="ts">
import { isAdmin } from '@/shared/auth/useAdmin';
import { formatBytes } from './image-meta';
import { ICONS } from './image-lightbox-icons';
import type { ImageRecord } from './image.types';

defineProps<{
  image: ImageRecord;
  saving: boolean;
  deleting: boolean;
}>();

const emit = defineEmits<{
  saveVisibilityFlag: [field: 'is_public' | 'location_public', value: 0 | 1];
}>();
</script>

<template>
  <section class="detail-section">
    <div class="section-title">
      <svg :viewBox="ICONS.fileAlt.vb" fill="currentColor" class="section-icon" aria-hidden="true"><path :d="ICONS.fileAlt.d" /></svg>
      <span>基本信息</span>
    </div>
    <div class="detail-items">
      <div class="detail-item">
        <span class="item-label">文件名</span>
        <span class="item-value text-truncate">{{ image.original_filename || image.key }}</span>
      </div>
      <div class="detail-item">
        <span class="item-label">文件大小</span>
        <span class="item-value">{{ formatBytes(image.bytes_compressed) }}</span>
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
          <label
            v-if="isAdmin"
            class="inline-flag"
            :class="{ 'is-on': image.is_public !== 0, 'is-busy': saving }"
            :title="image.is_public !== 0 ? '点击收回为私藏' : '点击公开到探索'"
          >
            <input
              type="checkbox"
              class="inline-flag-input"
              :checked="image.is_public !== 0"
              :disabled="saving || deleting"
              @change="emit('saveVisibilityFlag', 'is_public', ($event.target as HTMLInputElement).checked ? 1 : 0)"
            />
            <span class="inline-flag-switch" aria-hidden="true"></span>
            <span class="inline-flag-text">{{ image.is_public !== 0 ? '公开' : '私藏' }}</span>
          </label>
          <span v-else class="badge badge-lime">公开</span>
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped src="./image-lightbox.css"></style>
