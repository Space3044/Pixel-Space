<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue';
import AppShell from '@/shared/ui/AppShell.vue';
import type { ImageRecord } from '@/features/images/image.types';
import { listImages } from '@/features/images/images.api';
import {
  createFolder,
  deleteFolder,
  fetchFolders,
  moveImages,
  updateFolder,
  type FolderRecord,
} from './library.api';

const ImageLightbox = defineAsyncComponent(() => import('@/features/images/ImageLightbox.vue'));

const folders = ref<FolderRecord[]>([]);
const images = ref<ImageRecord[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);
const actionMessage = ref<string | null>(null);

// null 表示「根 / 未分类」。
const currentFolderId = ref<string | null>(null);
const selectedKeys = ref<Set<string>>(new Set());
const moveTarget = ref<string>('__none__');

const lightboxOpen = ref(false);
const lightboxImage = ref<ImageRecord | null>(null);

const foldersById = computed(() => {
  const map = new Map<string, FolderRecord>();
  for (const folder of folders.value) map.set(folder.id, folder);
  return map;
});

const foldersByParent = computed(() => {
  const map = new Map<string | null, FolderRecord[]>();
  for (const folder of folders.value) {
    const list = map.get(folder.parent_id) ?? [];
    list.push(folder);
    map.set(folder.parent_id, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }
  return map;
});

const subfolders = computed<FolderRecord[]>(() => foldersByParent.value.get(currentFolderId.value) ?? []);

const currentImages = computed<ImageRecord[]>(() =>
  images.value.filter((img) => (img.folder_id ?? null) === currentFolderId.value),
);

const currentFolder = computed<FolderRecord | null>(() =>
  currentFolderId.value ? foldersById.value.get(currentFolderId.value) ?? null : null,
);

const breadcrumb = computed<Array<{ id: string | null; name: string }>>(() => {
  const trail: Array<{ id: string | null; name: string }> = [{ id: null, name: '根目录' }];
  let cursor: string | null = currentFolderId.value;
  const stack: FolderRecord[] = [];
  while (cursor) {
    const folder = foldersById.value.get(cursor);
    if (!folder) break;
    stack.push(folder);
    cursor = folder.parent_id;
  }
  for (const folder of stack.reverse()) {
    trail.push({ id: folder.id, name: folder.name });
  }
  return trail;
});

// 把所有文件夹拼成「全路径」字符串，按层级缩进，用于 move 下拉选项。
// 当前目录与当前目录的后代（避免把图片移到正在浏览的同一层级或子树里其实是允许的，
// 但更直观的体验是把"当前目录"过滤掉，让用户只能选别的位置）。
interface FolderOption {
  id: string;
  label: string;
  depth: number;
}

const folderOptions = computed<FolderOption[]>(() => {
  const options: FolderOption[] = [];
  const walk = (parentId: string | null, depth: number, prefix: string) => {
    const children = foldersByParent.value.get(parentId) ?? [];
    for (const child of children) {
      const label = `${prefix}${child.name}`;
      options.push({ id: child.id, label, depth });
      walk(child.id, depth + 1, `${label} / `);
    }
  };
  walk(null, 0, '');
  return options;
});

const refreshAll = async () => {
  loading.value = true;
  loadError.value = null;
  try {
    const [folderList, imageList] = await Promise.all([fetchFolders(), listImages()]);
    folders.value = folderList;
    images.value = imageList;
  } catch (error) {
    loadError.value = (error as Error).message;
  } finally {
    loading.value = false;
  }
};

const enterFolder = (id: string | null) => {
  currentFolderId.value = id;
  selectedKeys.value = new Set();
  actionMessage.value = null;
};

const toggleSelection = (key: string) => {
  const next = new Set(selectedKeys.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  selectedKeys.value = next;
};

const selectAllCurrent = () => {
  selectedKeys.value = new Set(currentImages.value.map((img) => img.key));
};

const clearSelection = () => {
  selectedKeys.value = new Set();
};

const handleCreateFolder = async () => {
  const name = window.prompt('新建子文件夹，输入名称')?.trim();
  if (!name) return;
  try {
    const created = await createFolder({ name, parent_id: currentFolderId.value });
    folders.value = [...folders.value, created];
    actionMessage.value = `已新建 ${name}`;
  } catch (error) {
    const message = (error as Error).message;
    actionMessage.value = message.includes('name_conflict') ? '同级目录里已经有同名文件夹' : `新建失败：${message}`;
  }
};

const handleRenameCurrent = async () => {
  const folder = currentFolder.value;
  if (!folder) return;
  const next = window.prompt('重命名文件夹', folder.name)?.trim();
  if (!next || next === folder.name) return;
  try {
    const updated = await updateFolder(folder.id, { name: next });
    folders.value = folders.value.map((item) => (item.id === folder.id ? { ...item, ...updated } : item));
    actionMessage.value = `已重命名为 ${updated.name}`;
  } catch (error) {
    const message = (error as Error).message;
    actionMessage.value = message.includes('name_conflict') ? '同级目录里已经有同名文件夹' : `重命名失败：${message}`;
  }
};

const handleDeleteCurrent = async () => {
  const folder = currentFolder.value;
  if (!folder) return;
  if (folder.image_count > 0 || folder.child_count > 0) {
    actionMessage.value = '当前文件夹不为空，请先移走里面的图片和子目录';
    return;
  }
  if (!window.confirm(`确定删除文件夹「${folder.name}」？`)) return;
  try {
    await deleteFolder(folder.id);
    const parentId = folder.parent_id;
    folders.value = folders.value.filter((item) => item.id !== folder.id);
    currentFolderId.value = parentId;
    actionMessage.value = `已删除 ${folder.name}`;
  } catch (error) {
    const message = (error as Error).message;
    actionMessage.value = message.includes('not_empty')
      ? '当前文件夹不为空，请先移走里面的图片和子目录'
      : `删除失败：${message}`;
  }
};

const handleMove = async () => {
  if (selectedKeys.value.size === 0) return;
  const targetId = moveTarget.value === '__none__' ? null : moveTarget.value;
  if (targetId === currentFolderId.value) {
    actionMessage.value = '目标就是当前位置，没必要移动';
    return;
  }
  try {
    const keys = Array.from(selectedKeys.value);
    await moveImages({ keys, folder_id: targetId });
    images.value = images.value.map((img) =>
      selectedKeys.value.has(img.key) ? { ...img, folder_id: targetId } : img,
    );
    // 子文件夹计数局部刷新：旧位置 -1、新位置 +1（按移动张数）。
    const movedCount = keys.length;
    const updateCount = (folderId: string | null, delta: number) => {
      if (!folderId) return;
      folders.value = folders.value.map((folder) =>
        folder.id === folderId ? { ...folder, image_count: Math.max(0, folder.image_count + delta) } : folder,
      );
    };
    updateCount(currentFolderId.value, -movedCount);
    updateCount(targetId, movedCount);
    selectedKeys.value = new Set();
    actionMessage.value = `已移动 ${movedCount} 张到 ${targetId ? folderOptions.value.find((o) => o.id === targetId)?.label ?? '目标文件夹' : '根目录'}`;
  } catch (error) {
    actionMessage.value = `移动失败：${(error as Error).message}`;
  }
};

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
      <header class="library-header">
        <div class="library-title">
          <h1>文件库</h1>
          <p>把图片归到层级文件夹里，只对管理员可见</p>
        </div>

        <nav class="breadcrumb" aria-label="当前路径">
          <button
            v-for="(crumb, index) in breadcrumb"
            :key="crumb.id ?? '__root__'"
            type="button"
            class="crumb"
            :class="{ 'is-current': index === breadcrumb.length - 1 }"
            :disabled="index === breadcrumb.length - 1"
            @click="enterFolder(crumb.id)"
          >
            {{ crumb.name }}
          </button>
        </nav>

        <div class="library-actions">
          <button type="button" class="library-btn" @click="handleCreateFolder">新建文件夹</button>
          <button
            type="button"
            class="library-btn"
            :disabled="!currentFolder"
            @click="handleRenameCurrent"
          >
            重命名当前
          </button>
          <button
            type="button"
            class="library-btn danger"
            :disabled="!currentFolder"
            @click="handleDeleteCurrent"
          >
            删除当前
          </button>
          <button type="button" class="library-btn" @click="refreshAll">刷新</button>
        </div>
      </header>

      <p v-if="actionMessage" class="action-toast">{{ actionMessage }}</p>

      <div v-if="loading" class="state-card">加载中…</div>
      <div v-else-if="loadError" class="state-card is-error">加载失败：{{ loadError }}</div>

      <template v-else>
        <section v-if="subfolders.length > 0" class="folder-grid">
          <article
            v-for="folder in subfolders"
            :key="folder.id"
            class="folder-card"
            tabindex="0"
            role="button"
            :aria-label="`进入 ${folder.name}`"
            @click="enterFolder(folder.id)"
            @keydown.enter.prevent="enterFolder(folder.id)"
            @keydown.space.prevent="enterFolder(folder.id)"
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
            <button
              type="button"
              class="library-btn small"
              :disabled="selectedKeys.size === currentImages.length"
              @click="selectAllCurrent"
            >
              全选
            </button>
            <button
              type="button"
              class="library-btn small"
              :disabled="selectedKeys.size === 0"
              @click="clearSelection"
            >
              取消选择
            </button>
          </header>
          <div class="image-grid">
            <button
              v-for="img in currentImages"
              :key="img.key"
              type="button"
              class="image-tile"
              :class="{ 'is-selected': selectedKeys.has(img.key) }"
              @click.shift.prevent="toggleSelection(img.key)"
              @click.ctrl.prevent="toggleSelection(img.key)"
              @click.meta.prevent="toggleSelection(img.key)"
              @click.exact="openLightbox(img)"
            >
              <img :src="img.public_url" :alt="img.title" loading="lazy" />
              <span class="image-caption">{{ img.title || img.original_filename }}</span>
              <button
                type="button"
                class="select-toggle"
                :class="{ 'is-on': selectedKeys.has(img.key) }"
                :aria-label="selectedKeys.has(img.key) ? '取消选中' : '选中'"
                @click.stop="toggleSelection(img.key)"
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
          这个文件夹是空的。可以新建子文件夹，或回到上一级把图片移进来。
        </p>
      </template>

      <Transition name="move-bar">
        <div v-if="selectedKeys.size > 0" class="move-bar" role="region" aria-label="批量移动">
          <span>已选 {{ selectedKeys.size }} 张</span>
          <label class="move-bar-control">
            <span>移动到</span>
            <select v-model="moveTarget" class="move-select">
              <option value="__none__">/ 根目录</option>
              <option
                v-for="opt in folderOptions"
                :key="opt.id"
                :value="opt.id"
                :disabled="opt.id === currentFolderId"
              >
                {{ '— '.repeat(opt.depth) }}{{ opt.label }}
              </option>
            </select>
          </label>
          <button type="button" class="library-btn primary" @click="handleMove">移动</button>
          <button type="button" class="library-btn ghost" @click="clearSelection">取消</button>
        </div>
      </Transition>
    </section>

    <ImageLightbox
      :open="lightboxOpen"
      :image="lightboxImage"
      @close="lightboxOpen = false"
      @updated="replaceImage"
      @deleted="removeImage"
    />
  </AppShell>
</template>

<style scoped>
.library-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0 0 6rem;
}

.library-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.85rem;
  padding: 1rem 1.25rem;
  border: 1px solid rgba(53, 243, 255, 0.16);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(53, 243, 255, 0.08), transparent 36%),
    rgba(7, 7, 19, 0.62);
  backdrop-filter: blur(16px);
}

.library-title h1 {
  margin: 0;
  font-size: 1.55rem;
  font-weight: 900;
  color: white;
}

.library-title p {
  margin: 0.2rem 0 0;
  font-size: 0.78rem;
  color: rgba(203, 213, 225, 0.78);
}

.breadcrumb {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
}

.crumb {
  border: 0;
  background: transparent;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  font-size: 0.82rem;
  font-weight: 700;
  color: rgba(165, 243, 252, 0.86);
  cursor: pointer;
}

.crumb:hover:not(:disabled) {
  background: rgba(53, 243, 255, 0.1);
  color: rgb(53, 243, 255);
}

.crumb.is-current {
  color: white;
  background: rgba(53, 243, 255, 0.12);
  cursor: default;
}

.crumb + .crumb::before {
  content: '/';
  margin-right: 0.45rem;
  color: rgba(148, 163, 184, 0.45);
}

.library-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.library-btn {
  height: 32px;
  padding: 0 0.9rem;
  border: 1px solid rgba(53, 243, 255, 0.22);
  border-radius: 6px;
  background: rgba(9, 14, 28, 0.7);
  color: rgb(203, 213, 225);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 160ms ease, color 160ms ease, background 160ms ease;
}

.library-btn:hover:not(:disabled) {
  border-color: rgba(53, 243, 255, 0.62);
  color: rgb(53, 243, 255);
}

.library-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.library-btn.small {
  height: 28px;
  padding: 0 0.7rem;
  font-size: 0.72rem;
}

.library-btn.primary {
  background: rgba(53, 243, 255, 0.16);
  color: rgb(165, 243, 252);
  border-color: rgba(53, 243, 255, 0.55);
}

.library-btn.primary:hover:not(:disabled) {
  background: rgba(53, 243, 255, 0.24);
  color: white;
}

.library-btn.ghost {
  background: transparent;
}

.library-btn.danger {
  border-color: rgba(251, 113, 133, 0.4);
  color: rgb(253, 164, 175);
  background: rgba(251, 113, 133, 0.08);
}

.library-btn.danger:hover:not(:disabled) {
  background: rgba(251, 113, 133, 0.18);
  color: rgb(254, 205, 211);
}

.action-toast {
  margin: 0;
  padding: 0.55rem 0.85rem;
  border: 1px solid rgba(53, 243, 255, 0.22);
  border-radius: 6px;
  background: rgba(53, 243, 255, 0.06);
  color: rgb(165, 243, 252);
  font-size: 0.82rem;
}

.state-card {
  padding: 1.5rem;
  border: 1px dashed rgba(148, 163, 184, 0.24);
  border-radius: 8px;
  background: rgba(7, 7, 19, 0.45);
  color: rgba(203, 213, 225, 0.85);
  font-size: 0.85rem;
  text-align: center;
}

.state-card.is-error {
  border-color: rgba(251, 113, 133, 0.45);
  color: rgb(253, 164, 175);
  background: rgba(251, 113, 133, 0.08);
}

.folder-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 0.65rem;
}

.folder-card {
  display: grid;
  grid-template-columns: 2.2rem minmax(0, 1fr);
  gap: 0.8rem;
  align-items: center;
  padding: 0.85rem 0.95rem;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(53, 243, 255, 0.05), transparent 60%),
    rgba(7, 7, 19, 0.55);
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
}

.folder-card:hover,
.folder-card:focus-visible {
  border-color: rgba(53, 243, 255, 0.55);
  transform: translateY(-1px);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.34);
  outline: none;
}

.folder-icon {
  display: grid;
  place-items: center;
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 6px;
  background: rgba(53, 243, 255, 0.14);
  color: rgb(165, 243, 252);
}

.folder-icon svg {
  width: 18px;
  height: 18px;
}

.folder-name {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 800;
  color: white;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-meta {
  margin: 0.2rem 0 0;
  font-size: 0.72rem;
  color: rgba(148, 163, 184, 0.85);
}

.image-section {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.image-section-header {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.section-label {
  flex: 1;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(165, 243, 252, 0.84);
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: 0.65rem;
}

.image-tile {
  position: relative;
  display: block;
  aspect-ratio: 1 / 1;
  padding: 0;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 8px;
  background: rgba(7, 7, 19, 0.4);
  cursor: pointer;
  overflow: hidden;
  transition: border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
}

.image-tile:hover {
  border-color: rgba(53, 243, 255, 0.45);
  transform: translateY(-1px);
}

.image-tile.is-selected {
  border-color: rgba(132, 247, 153, 0.7);
  box-shadow: 0 0 0 2px rgba(132, 247, 153, 0.45);
}

.image-tile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.image-caption {
  position: absolute;
  inset: auto 0 0 0;
  padding: 0.4rem 0.55rem;
  font-size: 0.7rem;
  font-weight: 700;
  color: white;
  background: linear-gradient(180deg, transparent, rgba(7, 7, 19, 0.82));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.select-toggle {
  position: absolute;
  top: 0.4rem;
  left: 0.4rem;
  display: grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 999px;
  background: rgba(7, 7, 19, 0.55);
  color: white;
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease;
}

.select-toggle.is-on {
  border-color: rgba(132, 247, 153, 0.8);
  background: rgba(132, 247, 153, 0.85);
  color: rgb(7, 7, 19);
}

.select-toggle svg {
  width: 14px;
  height: 14px;
}

.move-bar {
  position: fixed;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.7rem 1rem;
  border: 1px solid rgba(53, 243, 255, 0.35);
  border-radius: 999px;
  background: rgba(7, 7, 19, 0.92);
  color: rgb(226, 232, 240);
  font-size: 0.8rem;
  font-weight: 700;
  z-index: 50;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(18px);
}

.move-bar-control {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: rgba(165, 243, 252, 0.86);
}

.move-select {
  height: 28px;
  border: 1px solid rgba(53, 243, 255, 0.25);
  border-radius: 6px;
  background: rgba(7, 7, 19, 0.75);
  color: rgb(226, 232, 240);
  padding: 0 0.5rem;
  font-size: 0.78rem;
  cursor: pointer;
}

.move-select option {
  background: rgb(9, 14, 28);
  color: rgb(226, 232, 240);
}

.move-bar-enter-active,
.move-bar-leave-active {
  transition: transform 240ms ease, opacity 240ms ease;
}

.move-bar-enter-from,
.move-bar-leave-to {
  transform: translate(-50%, 24px);
  opacity: 0;
}

@media (max-width: 720px) {
  .move-bar {
    flex-wrap: wrap;
    width: calc(100% - 1.5rem);
    border-radius: 12px;
    justify-content: center;
  }
}
</style>
