<script setup lang="ts">
import { archiveThumbClass, archiveThumbLabel } from './upload-archive-status';
import type { UploadEntry } from './useUploadQueue';

defineProps<{
  entries: UploadEntry[];
  currentEntryId: string | null;
  queueCountLabel: string;
  hasEntries: boolean;
  isBatchUploading: boolean;
}>();

const emit = defineEmits<{
  add: [];
  clear: [];
  remove: [id: string];
  select: [id: string];
}>();
</script>

<template>
  <aside class="queue-rail cyber-panel">
    <header class="queue-header">
      <p class="section-eyebrow">Queue</p>
      <span class="section-count">{{ queueCountLabel }}</span>
    </header>
    <div class="queue-list">
      <div
        v-for="entry in entries"
        :key="entry.id"
        class="thumb-cell"
      >
        <button
          type="button"
          class="thumb"
          :class="{
            'is-active': entry.id === currentEntryId,
            'is-busy': entry.status === 'processing' || entry.status === 'uploading',
            'is-done': entry.status === 'done',
            'is-error': entry.status === 'error',
          }"
          :aria-label="`选中 ${entry.file.name}`"
          :aria-current="entry.id === currentEntryId"
          @click="emit('select', entry.id)"
        >
          <img
            v-if="entry.previewUrl"
            :src="entry.previewUrl"
            :alt="entry.file.name"
            class="h-full w-full object-cover"
          />
          <span v-if="entry.status === 'processing'" class="thumb-badge is-busy">处理中</span>
          <span v-else-if="entry.status === 'uploading'" class="thumb-badge is-busy">上传中</span>
          <span v-else-if="entry.duplicate" class="thumb-badge is-dup">已存在</span>
          <span
            v-else-if="entry.status === 'done'"
            class="thumb-badge"
            :class="archiveThumbClass(entry)"
          >
            {{ archiveThumbLabel(entry) }}
          </span>
          <span v-else-if="entry.status === 'error'" class="thumb-badge is-error">失败</span>
        </button>
        <button
          type="button"
          class="thumb-remove"
          aria-label="从队列中移除"
          @click.stop="emit('remove', entry.id)"
        >
          <svg viewBox="0 0 384 512" fill="currentColor" aria-hidden="true">
            <path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z" />
          </svg>
        </button>
      </div>
      <button
        type="button"
        class="thumb-empty"
        :aria-label="hasEntries ? '继续添加图片' : '选择图片'"
        @click="emit('add')"
      >
        <svg viewBox="0 0 448 512" fill="currentColor" aria-hidden="true">
          <path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z" />
        </svg>
      </button>
    </div>
    <button
      v-if="hasEntries"
      type="button"
      class="queue-clear"
      :disabled="isBatchUploading"
      @click="emit('clear')"
    >
      清空队列
    </button>
  </aside>
</template>

<style scoped src="./upload-view.css"></style>
