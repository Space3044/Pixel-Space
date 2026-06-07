<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import AppShell from '@/shared/ui/AppShell.vue';
import { fetchAdminFolders, type FolderRecord } from '@/features/library/library.api';
import { createChinaPickAdapter, createWorldPickAdapter } from './pick-map';
import UploadActionRow from './UploadActionRow.vue';
import UploadMetaSidebar from './UploadMetaSidebar.vue';
import UploadPreviewStage from './UploadPreviewStage.vue';
import UploadQueueRail from './UploadQueueRail.vue';
import { useUploadFileSelection } from './useUploadFileSelection';
import { useUploadLocationSync } from './useUploadLocationSync';
import { useUploadPickMap } from './useUploadPickMap';
import { useUploadProcessing } from './useUploadProcessing';
import { useUploadQueue } from './useUploadQueue';

const {
  entries,
  currentEntryId,
  isBatchUploading,
  globalError,
  createEntry,
  currentEntry,
  hasCurrent,
  displayEntry,
  displayFileName,
  hasEntries,
  readyEntries,
  queueCountLabel,
  canSubmit,
  statusLabel,
  statusVariant,
  taskProgressMax,
  taskProgressValue,
  taskProgressStatus,
} = useUploadQueue();
const {
  mapRef,
  mapLoadState,
  pickRegion,
  syncMarker,
  setEntryCoordinates,
  mountMap,
  syncPickRegionFromEntry,
  onSearchRegionChange,
  syncCurrentEntryMap,
  destroyMap,
} = useUploadPickMap({
  currentEntry,
  createChinaAdapter: createChinaPickAdapter,
  createWorldAdapter: createWorldPickAdapter,
});

// 整批上传配置：目标文件夹 + 是否把当前图位置自动同步到队列里其它没坐标的图。
const batchFolderId = ref<string>('');
const folders = ref<FolderRecord[]>([]);

const setMapElement = (element: HTMLElement | null) => {
  mapRef.value = element;
};

const {
  syncLocation,
  broadcastLocationInto,
  updateLat,
  updateLng,
  clearLocation,
  setIsPublic,
  setLocationPublic,
  applyLocationSearchResult,
} = useUploadLocationSync({
  entries,
  currentEntry,
  syncMarker,
  setEntryCoordinates,
});

const loadFolders = async () => {
  try {
    folders.value = await fetchAdminFolders();
  } catch (error) {
    globalError.value = `文件夹加载失败：${(error as Error).message}`;
  }
};

const {
  enqueueProcess,
  triggerAiForCurrent,
  retryArchiveForCurrent,
  submitUploadAll,
} = useUploadProcessing({
  entries,
  currentEntry,
  currentEntryId,
  pickRegion,
  canSubmit,
  isBatchUploading,
  globalError,
  batchFolderId,
  setEntryCoordinates,
  onSearchRegionChange,
  broadcastLocationInto,
});

const {
  fileInputRef,
  releaseAllEntryPreviews,
  handleInputChange,
  handleDrop,
  openFilePicker,
  selectEntry,
  removeEntry,
  clearAll,
} = useUploadFileSelection({
  entries,
  currentEntryId,
  globalError,
  createEntry,
  enqueueProcess,
  syncPickRegionFromEntry,
});

watch(currentEntryId, syncCurrentEntryMap);

onMounted(() => {
  void mountMap();
  void loadFolders();
});

onBeforeUnmount(() => {
  releaseAllEntryPreviews();
  destroyMap();
});
</script>

<template>
  <AppShell fluid>
    <section class="upload-page">
      <div aria-hidden="true" class="orbs">
        <div class="orb orb-cyan" />
        <div class="orb orb-pink" />
      </div>

      <div class="page-inner">
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          multiple
          class="sr-only"
          @change="handleInputChange"
        />

        <UploadActionRow
          v-model:batch-folder-id="batchFolderId"
          v-model:sync-location="syncLocation"
          :has-entries="hasEntries"
          :folders="folders"
          :status-variant="statusVariant"
          :status-label="statusLabel"
          :task-progress-value="taskProgressValue"
          :task-progress-max="taskProgressMax"
          :task-progress-status="taskProgressStatus"
          :can-submit="canSubmit"
          :is-batch-uploading="isBatchUploading"
          :ready-count="readyEntries.length"
          @open="openFilePicker"
          @drop="handleDrop"
          @submit="submitUploadAll"
        />

        <div
          v-if="globalError"
          class="error-banner"
          role="alert"
        >
          <span aria-hidden="true" class="error-icon">!</span>
          <span>{{ globalError }}</span>
        </div>

        <div class="workbench">
          <UploadQueueRail
            :entries="entries"
            :current-entry-id="currentEntryId"
            :queue-count-label="queueCountLabel"
            :has-entries="hasEntries"
            :is-batch-uploading="isBatchUploading"
            @add="openFilePicker"
            @clear="clearAll"
            @remove="removeEntry"
            @select="selectEntry"
          />

          <UploadPreviewStage
            :current-entry="currentEntry"
            @retry-archive="retryArchiveForCurrent"
          />

          <UploadMetaSidebar
            :current-entry="currentEntry"
            :display-entry="displayEntry"
            :display-file-name="displayFileName"
            :has-current="hasCurrent"
            :map-load-state="mapLoadState"
            :pick-region="pickRegion"
            @map-element="setMapElement"
            @trigger-ai="triggerAiForCurrent"
            @set-is-public="setIsPublic"
            @set-location-public="setLocationPublic"
            @clear-location="clearLocation"
            @apply-location-search-result="applyLocationSearchResult"
            @search-region-change="onSearchRegionChange"
            @update-lat="updateLat"
            @update-lng="updateLng"
          />
        </div>
      </div>
    </section>
  </AppShell>
</template>

<style scoped src="./upload-view.css"></style>
