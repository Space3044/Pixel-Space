<script setup lang="ts">
import { defineAsyncComponent, onMounted, ref } from 'vue';
import AppShell from '@/shared/ui/AppShell.vue';
import LoadingState from '@/shared/ui/LoadingState.vue';
import type { ImageRecord } from '@/features/images/image.types';
import DownloadGrantDialog from './DownloadGrantDialog.vue';
import type { DownloadGrantRecord, FolderRecord } from './library.api';
import LibraryContent from './LibraryContent.vue';
import LibraryHeader from './LibraryHeader.vue';
import LibraryMoveBar from './LibraryMoveBar.vue';
import { useLibraryActions } from './useLibraryActions';
import { useLibraryDirectory } from './useLibraryDirectory';

const ImageLightbox = defineAsyncComponent(() => import('@/features/images/ImageLightbox.vue'));

const folders = ref<FolderRecord[]>([]);
const images = ref<ImageRecord[]>([]);
const downloadGrants = ref<DownloadGrantRecord[]>([]);

const lightboxOpen = ref(false);
const lightboxImage = ref<ImageRecord | null>(null);

const {
  currentFolderId,
  sortMode,
  subfolders,
  virtualCounts,
  currentImages,
  currentFolder,
  currentVirtual,
  currentReadonly,
  breadcrumb,
  folderOptions,
} = useLibraryDirectory({ folders, images, downloadGrants });

const {
  loading,
  loadError,
  actionMessage,
  grantDialogOpen,
  grantCreating,
  grantResult,
  grantError,
  grantManagingId,
  grantManagerError,
  aiSettingsForm,
  aiSettingsSaving,
  selectedKeys,
  moveTarget,
  refreshAll,
  enterFolder,
  toggleSelection,
  selectAllCurrent,
  clearSelection,
  clearGrantResult,
  handleCreateDownloadGrant,
  handleUpdateDownloadGrant,
  handleDeleteDownloadGrant,
  handleCreateFolder,
  handleRenameCurrent,
  handleDeleteCurrent,
  handleMove,
  handleBatchDelete,
  saveAiSettings,
} = useLibraryActions({
  folders,
  images,
  downloadGrants,
  currentFolderId,
  currentFolder,
  currentReadonly,
  currentImages,
  folderOptions,
});

const openLightbox = (img: ImageRecord) => {
  lightboxImage.value = img;
  lightboxOpen.value = true;
};

const replaceImage = (img: ImageRecord) => {
  images.value = images.value.map((item) => (item.key === img.key ? img : item));
  lightboxImage.value = img;
};

const removeImage = (key: string) => {
  images.value = images.value.filter((item) => item.key !== key);
  lightboxOpen.value = false;
  lightboxImage.value = null;
};

onMounted(refreshAll);
</script>

<template>
  <AppShell fluid>
    <section class="library-page">
      <LibraryHeader
        :ai-settings-form="aiSettingsForm"
        :ai-settings-saving="aiSettingsSaving"
        :breadcrumb="breadcrumb"
        :current-folder="currentFolder"
        :current-folder-id="currentFolderId"
        :current-virtual="currentVirtual"
        :virtual-counts="virtualCounts"
        @enter-folder="enterFolder"
        @create-folder="handleCreateFolder"
        @rename-current="handleRenameCurrent"
        @delete-current="handleDeleteCurrent"
        @refresh="refreshAll"
        @save-ai-settings="saveAiSettings"
      />

      <p v-if="actionMessage" class="action-toast">{{ actionMessage }}</p>

      <LoadingState v-if="loading" title="正在加载控制台" message="同步文件夹、图片和授权信息" />
      <LoadingState v-else-if="loadError" title="控制台加载失败" :error="loadError" />

      <LibraryContent
        v-else
        v-model:sort-mode="sortMode"
        :current-folder-id="currentFolderId"
        :current-images="currentImages"
        :current-readonly="currentReadonly"
        :current-virtual="currentVirtual"
        :download-grants="downloadGrants"
        :grant-manager-error="grantManagerError"
        :grant-managing-id="grantManagingId"
        :selected-keys="selectedKeys"
        :subfolders="subfolders"
        @update-grant="handleUpdateDownloadGrant"
        @delete-grant="handleDeleteDownloadGrant"
        @enter-folder="enterFolder"
        @select-all-current="selectAllCurrent"
        @clear-selection="clearSelection"
        @toggle-selection="toggleSelection"
        @open-lightbox="openLightbox"
      />

      <LibraryMoveBar
        v-model:move-target="moveTarget"
        :current-folder-id="currentFolderId"
        :folder-options="folderOptions"
        :selected-count="selectedKeys.size"
        @open-grant="grantDialogOpen = true"
        @move="handleMove"
        @delete="handleBatchDelete"
        @cancel="clearSelection"
      />
    </section>

    <ImageLightbox
      :open="lightboxOpen"
      :image="lightboxImage"
      @close="lightboxOpen = false"
      @updated="replaceImage"
      @deleted="removeImage"
    />
    <DownloadGrantDialog
      :open="grantDialogOpen"
      :selected-count="selectedKeys.size"
      :loading="grantCreating"
      :result="grantResult"
      :error="grantError"
      @close="grantDialogOpen = false"
      @create="handleCreateDownloadGrant"
      @clear="clearGrantResult"
    />
  </AppShell>
</template>

<style scoped src="./library-view.css"></style>
