import { ref, type Ref } from 'vue';

import type { UploadEntry } from './useUploadQueue';

const MAX_ORIGINAL_BYTES = 50 * 1024 * 1024;

type FileWithRelativePath = File & { webkitRelativePath?: string };

const queueFileKey = (file: File): string => {
  const path = (file as FileWithRelativePath).webkitRelativePath || file.name;
  return [path, file.size, file.type, file.lastModified].join('\u0000');
};

interface UseUploadFileSelectionOptions {
  entries: Ref<UploadEntry[]>;
  currentEntryId: Ref<string | null>;
  globalError: Ref<string | null>;
  createEntry: (file: File) => UploadEntry;
  enqueueProcess: (entry: UploadEntry) => void;
  syncPickRegionFromEntry: (entry: UploadEntry | null) => Promise<void>;
}

export const useUploadFileSelection = ({
  entries,
  currentEntryId,
  globalError,
  createEntry,
  enqueueProcess,
  syncPickRegionFromEntry,
}: UseUploadFileSelectionOptions) => {
  const fileInputRef = ref<HTMLInputElement | null>(null);

  const releaseEntryPreview = (entry: UploadEntry) => {
    if (entry.previewObjectUrl) {
      URL.revokeObjectURL(entry.previewObjectUrl);
      entry.previewObjectUrl = null;
    }
    entry.previewUrl = null;
  };

  const releaseAllEntryPreviews = () => {
    for (const entry of entries.value) releaseEntryPreview(entry);
  };

  const addFiles = (files: File[]) => {
    globalError.value = null;
    const accepted: UploadEntry[] = [];
    const queuedFileKeys = new Set(entries.value.map((entry) => queueFileKey(entry.file)));
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        globalError.value = `已跳过非图片文件：${file.name}`;
        continue;
      }
      if (file.size > MAX_ORIGINAL_BYTES) {
        globalError.value = `已跳过超过 50MB 的文件：${file.name}`;
        continue;
      }
      const fileKey = queueFileKey(file);
      if (queuedFileKeys.has(fileKey)) {
        globalError.value = `已跳过队列中重复文件：${file.name}`;
        continue;
      }
      const entry = createEntry(file);
      entries.value.push(entry);
      accepted.push(entry);
      queuedFileKeys.add(fileKey);
    }
    if (accepted.length === 0) return;
    if (currentEntryId.value === null) {
      currentEntryId.value = accepted[0].id;
    }
    for (const entry of accepted) enqueueProcess(entry);
  };

  const handleInputChange = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (files.length > 0) addFiles(files);
    input.value = '';
  };

  const handleDrop = (event: DragEvent) => {
    const files = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : [];
    if (files.length > 0) addFiles(files);
  };

  const openFilePicker = () => {
    fileInputRef.value?.click();
  };

  const selectEntry = (entryId: string) => {
    const entry = entries.value.find((item) => item.id === entryId) ?? null;
    if (!entry) return;
    if (currentEntryId.value === entryId) return;
    currentEntryId.value = entryId;
    void syncPickRegionFromEntry(entry);
  };

  const removeEntry = (entryId: string) => {
    const index = entries.value.findIndex((entry) => entry.id === entryId);
    if (index === -1) return;
    const entry = entries.value[index];
    releaseEntryPreview(entry);
    entries.value.splice(index, 1);
    if (currentEntryId.value !== entryId) return;
    const nextEntry = entries.value[index] ?? entries.value[index - 1] ?? null;
    currentEntryId.value = nextEntry?.id ?? null;
    void syncPickRegionFromEntry(nextEntry);
  };

  const clearAll = () => {
    releaseAllEntryPreviews();
    entries.value = [];
    currentEntryId.value = null;
    void syncPickRegionFromEntry(null);
    globalError.value = null;
  };

  return {
    fileInputRef,
    releaseEntryPreview,
    releaseAllEntryPreviews,
    addFiles,
    handleInputChange,
    handleDrop,
    openFilePicker,
    selectEntry,
    removeEntry,
    clearAll,
  };
};
