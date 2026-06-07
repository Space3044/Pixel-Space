<script setup lang="ts">
import { computed } from 'vue';

import { formatBytes } from '@/features/images/image-meta';
import { formatExifTakenAt } from './exif';
import type { UploadEntry } from './useUploadQueue';

const props = defineProps<{
  currentEntry: UploadEntry | null;
  displayEntry: UploadEntry;
  displayFileName: string;
}>();

const originalSize = computed(() => formatBytes(props.currentEntry?.file.size ?? 0, '--'));
const compressedSize = computed(() => formatBytes(props.currentEntry?.compressedFile?.size ?? 0, '--'));

const displayValue = (value: string | number | null): string => {
  if (value === null || value === '') return '--';
  return String(value);
};

const formatFocalLength = (value: number | null): string => {
  if (value === null) return '--';
  return `${Number(value.toFixed(2))} mm`;
};
</script>

<template>
  <section class="meta-section">
    <header class="meta-section-title">
      <svg viewBox="0 0 384 512" fill="currentColor" aria-hidden="true"><path d="M0 64C0 28.7 28.7 0 64 0H224V128c0 17.7 14.3 32 32 32H384V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V64zm384 64H256V0L384 128z" /></svg>
      <span>文件</span>
    </header>
    <dl class="meta-list">
      <div class="meta-row">
        <dt>文件名</dt>
        <dd class="truncate font-mono">{{ displayFileName }}</dd>
      </div>
      <div class="meta-row">
        <dt>原始大小</dt>
        <dd class="font-mono">{{ originalSize }}</dd>
      </div>
      <div class="meta-row">
        <dt>压缩后</dt>
        <dd class="font-mono">{{ compressedSize }}</dd>
      </div>
    </dl>
    <p v-if="currentEntry?.archiveRetryError" class="archive-retry-error">
      {{ currentEntry.archiveRetryError }}
    </p>
  </section>

  <section class="meta-section">
    <header class="meta-section-title">
      <svg viewBox="0 0 512 512" fill="currentColor" aria-hidden="true"><path d="M149.1 64.8L138.7 96H64C28.7 96 0 124.7 0 160V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H373.3L362.9 64.8C356.4 45.2 338.1 32 317.4 32H194.6c-20.7 0-39 13.2-45.5 32.8zM256 192a96 96 0 1 1 0 192 96 96 0 1 1 0-192z" /></svg>
      <span>EXIF</span>
    </header>
    <dl class="exif-grid">
      <div class="meta-row exif-row-wide">
        <dt>拍摄时间</dt>
        <dd class="font-mono">{{ formatExifTakenAt(displayEntry.exif.taken_at) }}</dd>
      </div>
      <div class="meta-row exif-row-wide">
        <dt>相机</dt>
        <dd class="font-mono truncate">{{ displayValue(displayEntry.exif.camera) }}</dd>
      </div>
      <div class="meta-row">
        <dt>ISO</dt>
        <dd class="font-mono">{{ displayValue(displayEntry.exif.iso) }}</dd>
      </div>
      <div class="meta-row">
        <dt>快门</dt>
        <dd class="font-mono">{{ displayValue(displayEntry.exif.shutter) }}</dd>
      </div>
      <div class="meta-row">
        <dt>光圈</dt>
        <dd class="font-mono">{{ displayEntry.exif.aperture === null ? '--' : `f/${displayEntry.exif.aperture}` }}</dd>
      </div>
      <div class="meta-row">
        <dt>焦距</dt>
        <dd class="font-mono">{{ formatFocalLength(displayEntry.exif.focal_length) }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped src="./upload-view.css"></style>
