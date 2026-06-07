import { computed, ref, type Ref } from 'vue';

import { sortImagesByMode, type ImageSortMode } from '../images/image-sort';
import type { ImageRecord } from '../images/image.types';
import type { DownloadGrantRecord, FolderRecord } from './library.api';

export const VIRTUAL_HIDDEN_IMAGES = '__hidden_images__';
export const VIRTUAL_HIDDEN_LOCATIONS = '__hidden_locations__';
export const VIRTUAL_DOWNLOAD_GRANTS = '__download_grants__';

export interface VirtualFolder {
  id: typeof VIRTUAL_HIDDEN_IMAGES | typeof VIRTUAL_HIDDEN_LOCATIONS | typeof VIRTUAL_DOWNLOAD_GRANTS;
  name: string;
  description: string;
}

export interface FolderOption {
  id: string;
  label: string;
  depth: number;
}

interface UseLibraryDirectoryOptions {
  folders: Ref<FolderRecord[]>;
  images: Ref<ImageRecord[]>;
  downloadGrants: Ref<DownloadGrantRecord[]>;
}

export const virtualFolders: VirtualFolder[] = [
  { id: VIRTUAL_HIDDEN_IMAGES, name: '未公开图片', description: '仅管理员可见的私有图片' },
  { id: VIRTUAL_HIDDEN_LOCATIONS, name: '未公开位置', description: '位置对访客隐藏的图片' },
  { id: VIRTUAL_DOWNLOAD_GRANTS, name: '验证码管理', description: '查看验证码、授权图片与过期时间' },
];

export const isVirtualId = (id: string | null): id is VirtualFolder['id'] =>
  id === VIRTUAL_HIDDEN_IMAGES || id === VIRTUAL_HIDDEN_LOCATIONS || id === VIRTUAL_DOWNLOAD_GRANTS;

export const useLibraryDirectory = ({ folders, images, downloadGrants }: UseLibraryDirectoryOptions) => {
  const currentFolderId = ref<string | null>(null);
  const sortMode = ref<ImageSortMode>('created-desc');

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

  const subfolders = computed<FolderRecord[]>(() => {
    if (isVirtualId(currentFolderId.value)) return [];
    return foldersByParent.value.get(currentFolderId.value) ?? [];
  });

  const virtualCounts = computed(() => ({
    [VIRTUAL_HIDDEN_IMAGES]: images.value.filter((img) => Number(img.is_public) === 0).length,
    [VIRTUAL_HIDDEN_LOCATIONS]: images.value.filter((img) => Number(img.location_public) === 0).length,
    [VIRTUAL_DOWNLOAD_GRANTS]: downloadGrants.value.length,
  }));

  const filteredCurrentImages = computed<ImageRecord[]>(() => {
    const cur = currentFolderId.value;
    if (cur === VIRTUAL_HIDDEN_IMAGES) return images.value.filter((img) => Number(img.is_public) === 0);
    if (cur === VIRTUAL_HIDDEN_LOCATIONS) return images.value.filter((img) => Number(img.location_public) === 0);
    if (cur === VIRTUAL_DOWNLOAD_GRANTS) return [];
    return images.value.filter((img) => (img.folder_id ?? null) === cur);
  });

  const currentImages = computed<ImageRecord[]>(() => sortImagesByMode(filteredCurrentImages.value, sortMode.value));

  const currentFolder = computed<FolderRecord | null>(() =>
    currentFolderId.value && !isVirtualId(currentFolderId.value)
      ? foldersById.value.get(currentFolderId.value) ?? null
      : null,
  );

  const currentVirtual = computed<VirtualFolder | null>(() => {
    const cur = currentFolderId.value;
    if (!isVirtualId(cur)) return null;
    return virtualFolders.find((v) => v.id === cur) ?? null;
  });

  const currentReadonly = computed(() => currentVirtual.value !== null);

  const breadcrumb = computed<Array<{ id: string | null; name: string }>>(() => {
    const trail: Array<{ id: string | null; name: string }> = [{ id: null, name: '根目录' }];
    if (currentVirtual.value) {
      trail.push({ id: currentVirtual.value.id, name: currentVirtual.value.name });
      return trail;
    }
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

  return {
    currentFolderId,
    sortMode,
    foldersById,
    foldersByParent,
    subfolders,
    virtualCounts,
    filteredCurrentImages,
    currentImages,
    currentFolder,
    currentVirtual,
    currentReadonly,
    breadcrumb,
    folderOptions,
  };
};
