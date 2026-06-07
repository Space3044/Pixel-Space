<script setup lang="ts">
import { archiveStatusClass, archiveStatusLabel } from './upload-archive-status';
import type { UploadEntry } from './useUploadQueue';

defineProps<{
  currentEntry: UploadEntry | null;
}>();

const emit = defineEmits<{
  retryArchive: [];
}>();
</script>

<template>
  <figure class="preview-stage cyber-panel">
    <template v-if="currentEntry?.previewUrl">
      <img
        :src="currentEntry.previewUrl"
        :alt="currentEntry.file.name"
        class="preview-image"
      />
      <figcaption class="preview-caption">
        <span class="preview-name">{{ currentEntry.file.name }}</span>
        <span v-if="currentEntry.status === 'processing'" class="preview-busy">处理中</span>
        <span v-else-if="currentEntry.status === 'uploading'" class="preview-busy">上传中</span>
        <span v-else-if="currentEntry.duplicate" class="preview-dup">已存在，跳过上传</span>
        <span
          v-else-if="currentEntry.status === 'done'"
          class="preview-status-group"
        >
          <span :class="archiveStatusClass(currentEntry)">
            {{ archiveStatusLabel(currentEntry) }}
          </span>
          <button
            v-if="currentEntry.uploadResult?.tg_status === 'failed'"
            type="button"
            class="archive-retry-button"
            :disabled="currentEntry.archiveRetrying"
            @click="emit('retryArchive')"
          >
            {{ currentEntry.archiveRetrying ? '重试中' : '重试归档' }}
          </button>
        </span>
        <span v-else-if="currentEntry.status === 'error'" class="preview-error">{{ currentEntry.errorMessage || '处理失败' }}</span>
        <span v-else-if="currentEntry.compressedFile" class="preview-ok">已压缩</span>
      </figcaption>
    </template>
    <template v-else>
      <div class="absolute inset-0 bg-panel/40" />
      <div class="absolute inset-0 bg-gradient-to-br from-neon-cyan/10 via-transparent to-neon-pink/10" />
      <div class="absolute inset-0 bg-grid bg-[length:64px_64px] opacity-25" />
      <figcaption class="preview-placeholder">
        <span>未选中图片</span>
        <span class="text-xs text-slate-500">从上方拖拽或点击选择</span>
      </figcaption>
    </template>
  </figure>
</template>

<style scoped src="./upload-view.css"></style>
