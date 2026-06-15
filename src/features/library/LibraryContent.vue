<script setup lang="ts">
import type { ImageRecord } from '@/features/images/image.types';
import { imageSortOptions, type ImageSortMode } from '@/features/images/image-sort';
import SelectPopover from '@/shared/ui/SelectPopover.vue';
import DownloadGrantManager from './DownloadGrantManager.vue';
import type { DownloadGrantRecord, FolderRecord } from './library.api';
import { useLibraryDragSelection } from './useLibraryDragSelection';
import { VIRTUAL_DOWNLOAD_GRANTS, type VirtualFolder } from './useLibraryDirectory';

const props = defineProps<{
  currentFolderId: string | null;
  currentImages: ImageRecord[];
  currentReadonly: boolean;
  currentVirtual: VirtualFolder | null;
  downloadGrants: DownloadGrantRecord[];
  grantManagerError: string | null;
  grantManagingId: string | null;
  selectedKeys: Set<string>;
  subfolders: FolderRecord[];
}>();

const sortMode = defineModel<ImageSortMode>('sortMode', { required: true });

const emit = defineEmits<{
  clearSelection: [];
  deleteGrant: [id: string];
  enterFolder: [id: string | null];
  openLightbox: [image: ImageRecord];
  selectAllCurrent: [];
  toggleSelection: [key: string];
  dragSelect: [key: string];
  updateGrant: [id: string, expiresAt: string];
}>();

const {
  isDragSelecting,
  onTilePointerDown,
  onTilePointerEnter,
  onTilePointerUp,
  onTilePointerCancel,
  shouldSuppressClick,
} = useLibraryDragSelection({
  canSelect: () => !props.currentReadonly,
  select: (key) => emit('dragSelect', key),
});

const handleTileClick = (img: ImageRecord) => {
  if (shouldSuppressClick()) return;
  emit('openLightbox', img);
};
</script>

<template>
  <DownloadGrantManager
    v-if="currentFolderId === VIRTUAL_DOWNLOAD_GRANTS"
    :grants="downloadGrants"
    :loading-id="grantManagingId"
    :error="grantManagerError"
    @update="(id, expiresAt) => emit('updateGrant', id, expiresAt)"
    @delete="emit('deleteGrant', $event)"
  />

  <template v-else>
    <section v-if="subfolders.length > 0" class="folder-grid" aria-label="文件夹">
      <article
        v-for="folder in subfolders"
        :key="folder.id"
        class="folder-card"
        tabindex="0"
        role="button"
        :aria-label="`进入 ${folder.name}`"
        @click="emit('enterFolder', folder.id)"
        @keydown.enter.prevent="emit('enterFolder', folder.id)"
        @keydown.space.prevent="emit('enterFolder', folder.id)"
      >
        <div class="folder-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 4h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
          </svg>
        </div>
        <div class="folder-body">
          <p class="folder-name">{{ folder.name }}</p>
          <p class="folder-meta">
            {{ folder.image_count }} 张图片 · {{ folder.child_count }} 个子目录
          </p>
        </div>
      </article>
    </section>

    <section v-if="currentImages.length > 0" class="image-section">
      <header class="image-section-header">
        <span class="section-label">本目录图片 · {{ currentImages.length }}</span>
        <SelectPopover v-model="sortMode" :options="imageSortOptions" aria-label="排序方式">
          <template #leading-icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="leading-icon" aria-hidden="true">
              <path d="M3 6h13" />
              <path d="M3 12h9" />
              <path d="M3 18h5" />
              <path d="m17 8 4 4-4 4" />
              <path d="M21 12H10" />
            </svg>
          </template>
        </SelectPopover>
        <button
          v-if="!currentReadonly"
          type="button"
          class="library-btn small"
          :disabled="selectedKeys.size === currentImages.length"
          @click="emit('selectAllCurrent')"
        >
          全选
        </button>
        <button
          v-if="!currentReadonly"
          type="button"
          class="library-btn small"
          :disabled="selectedKeys.size === 0"
          @click="emit('clearSelection')"
        >
          取消选择
        </button>
      </header>
      <div class="image-grid" :class="{ 'is-drag-selecting': isDragSelecting }">
        <button
          v-for="img in currentImages"
          :key="img.key"
          type="button"
          class="image-tile"
          :class="{ 'is-selected': selectedKeys.has(img.key) }"
          @pointerdown="onTilePointerDown(img.key, $event)"
          @pointerenter="onTilePointerEnter(img.key)"
          @pointerup="onTilePointerUp($event)"
          @pointercancel="onTilePointerCancel($event)"
          @click.shift.prevent="emit('toggleSelection', img.key)"
          @click.ctrl.prevent="emit('toggleSelection', img.key)"
          @click.meta.prevent="emit('toggleSelection', img.key)"
          @click.exact="handleTileClick(img)"
        >
          <img :src="img.public_url" :alt="img.title" loading="lazy" draggable="false" @dragstart.prevent />
          <span class="image-caption">{{ img.title || img.original_filename }}</span>
          <button
            v-if="!currentReadonly"
            type="button"
            class="select-toggle"
            :class="{ 'is-on': selectedKeys.has(img.key) }"
            :aria-label="selectedKeys.has(img.key) ? '取消选中' : '选中'"
            @pointerdown.stop
            @click.stop="emit('toggleSelection', img.key)"
          >
            <svg v-if="selectedKeys.has(img.key)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
              <path d="m5 12 5 5L20 7" />
            </svg>
          </button>
        </button>
      </div>
    </section>

    <p
      v-if="subfolders.length === 0 && currentImages.length === 0"
      class="state-card"
    >
      <template v-if="currentVirtual">没有符合「{{ currentVirtual.name }}」条件的图片。</template>
      <template v-else>这个文件夹是空的。可以新建子文件夹，或回到上一级把图片移进来。</template>
    </p>
  </template>
</template>

<style scoped src="./library-view.css"></style>
