<script setup lang="ts">
import FolderPickerPopover from '@/features/images/FolderPickerPopover.vue';
import type { FolderRecord } from '@/features/library/library.api';
import TaskProgress from '@/shared/ui/TaskProgress.vue';

defineProps<{
  hasEntries: boolean;
  folders: FolderRecord[];
  statusVariant: string;
  statusLabel: string;
  taskProgressValue: number | null;
  taskProgressMax: number;
  taskProgressStatus: 'idle' | 'loading' | 'success' | 'error';
  canSubmit: boolean;
  isBatchUploading: boolean;
  readyCount: number;
}>();

const batchFolderId = defineModel<string>('batchFolderId', { required: true });
const syncLocation = defineModel<boolean>('syncLocation', { required: true });

const emit = defineEmits<{
  open: [];
  drop: [event: DragEvent];
  submit: [];
}>();
</script>

<template>
  <div class="action-row">
    <button
      type="button"
      class="drop-zone"
      :class="{ 'is-compact': hasEntries }"
      @click="emit('open')"
      @dragover.prevent
      @drop.prevent="emit('drop', $event)"
    >
      <span class="drop-icon" aria-hidden="true">
        <svg viewBox="0 0 512 512" fill="currentColor"><path d="M288 109.3V352c0 17.7-14.3 32-32 32s-32-14.3-32-32V109.3l-73.4 73.4c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l128-128c12.5-12.5 32.8-12.5 45.3 0l128 128c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L288 109.3zM64 352H192c0 35.3 28.7 64 64 64s64-28.7 64-64H448c35.3 0 64 28.7 64 64v32c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V416c0-35.3 28.7-64 64-64z" /></svg>
      </span>
      <div class="drop-text">
        <p class="drop-title">{{ hasEntries ? '继续添加更多图片' : '拖拽图片到此或点击选择（支持多选）' }}</p>
        <p class="drop-hint">单张上限 50 MB，自动压缩为 WebP</p>
      </div>
    </button>

    <div class="action-stack">
      <div class="options-pill">
        <div class="options-cell">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="options-icon" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
          <span class="options-label">放入文件夹</span>
          <FolderPickerPopover
            v-model="batchFolderId"
            :folders="folders"
            placeholder="不放入"
            :show-none="false"
          />
        </div>
        <label
          class="options-cell sync-toggle"
          :class="{ 'is-on': syncLocation }"
          :title="
            syncLocation
              ? '当前图位置会自动补到队列里其它没坐标的图'
              : '开启后，给当前图设位置会同步到没坐标的图'
          "
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="options-icon" aria-hidden="true">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span class="options-label">位置同步</span>
          <input v-model="syncLocation" type="checkbox" class="sync-input" />
          <span class="sync-switch" aria-hidden="true" />
        </label>
      </div>

      <aside class="action-pill" :class="statusVariant">
        <TaskProgress
          class="action-progress"
          :label="statusLabel"
          :value="taskProgressValue"
          :max="taskProgressMax"
          :status="taskProgressStatus"
          compact
        />
        <button
          type="button"
          class="cyber-button submit-button"
          aria-label="上传图片"
          :disabled="!canSubmit"
          @click="emit('submit')"
        >
          {{ isBatchUploading ? '上传中' : `上传 ${readyCount || ''} 张`.trim() }}
        </button>
      </aside>
    </div>
  </div>
</template>

<style scoped src="./upload-view.css"></style>
