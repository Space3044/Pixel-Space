import { computed, ref } from 'vue';

import type { ImageRecord } from '@/features/images/image.types';
import type { UploadDimensions, UploadExif, UploadMeta } from './upload.types';

export type EntryStatus = 'processing' | 'ready' | 'uploading' | 'done' | 'error';
export type AiStatus = 'idle' | 'pending' | 'done' | 'failed';

export interface UploadEntry {
  id: string;
  file: File;
  previewUrl: string | null;
  previewObjectUrl: string | null;
  compressedFile: File | null;
  compressedDimensions: UploadDimensions | null;
  aiPreviewFile: File | null;
  exif: UploadExif;
  meta: UploadMeta;
  status: EntryStatus;
  errorMessage: string | null;
  aiStatus: AiStatus;
  aiError: string | null;
  aiRequestId: number;
  uploadResult: ImageRecord | null;
  archiveRetrying: boolean;
  archiveRetryError: string | null;
  duplicate: boolean;
}

interface UploadQueueOptions {
  createObjectUrl?: (file: File) => string;
}

export const emptyUploadExif = (): UploadExif => ({
  taken_at: null,
  camera: null,
  iso: null,
  aperture: null,
  shutter: null,
  focal_length: null,
  location_lat: null,
  location_lng: null,
});

export const createUploadMeta = (file: File): UploadMeta => ({
  title: file.name.replace(/\.[^.]+$/, ''),
  caption: '',
  location_name: '',
  location_lat: null,
  location_lng: null,
  location_region: null,
  tags: '',
  search_content: '',
  dominant_color: '',
  palette: '',
  composition: '',
  ai_status: 'pending',
  is_public: 1,
  location_public: 1,
  folder_id: null,
});

export const useUploadQueue = (options: UploadQueueOptions = {}) => {
  const createObjectUrl = options.createObjectUrl ?? ((file: File) => URL.createObjectURL(file));
  let entryIdSeq = 0;
  const nextEntryId = () => `e_${++entryIdSeq}`;

  const createEntry = (file: File): UploadEntry => {
    const previewObjectUrl = createObjectUrl(file);
    return {
      id: nextEntryId(),
      file,
      previewUrl: previewObjectUrl,
      previewObjectUrl,
      compressedFile: null,
      compressedDimensions: null,
      aiPreviewFile: null,
      exif: emptyUploadExif(),
      meta: createUploadMeta(file),
      status: 'processing',
      errorMessage: null,
      aiStatus: 'idle',
      aiError: null,
      aiRequestId: 0,
      uploadResult: null,
      archiveRetrying: false,
      archiveRetryError: null,
      duplicate: false,
    };
  };

  const entries = ref<UploadEntry[]>([]);
  const currentEntryId = ref<string | null>(null);
  const isBatchUploading = ref(false);
  const globalError = ref<string | null>(null);

  const currentEntry = computed(() => entries.value.find((entry) => entry.id === currentEntryId.value) ?? null);
  const hasCurrent = computed(() => currentEntry.value !== null);

  const emptyEntry = ref<UploadEntry>({
    id: '__placeholder__',
    file: new File([], ''),
    previewUrl: null,
    previewObjectUrl: null,
    compressedFile: null,
    compressedDimensions: null,
    aiPreviewFile: null,
    exif: emptyUploadExif(),
    meta: createUploadMeta(new File([], '')),
    status: 'ready',
    errorMessage: null,
    aiStatus: 'idle',
    aiError: null,
    aiRequestId: 0,
    uploadResult: null,
    archiveRetrying: false,
    archiveRetryError: null,
    duplicate: false,
  });

  const displayEntry = computed<UploadEntry>(() => currentEntry.value ?? emptyEntry.value);
  const displayFileName = computed(() => currentEntry.value?.file.name ?? '--');
  const hasEntries = computed(() => entries.value.length > 0);
  const readyEntries = computed(() => entries.value.filter((entry) => entry.status === 'ready'));
  const doneEntries = computed(() =>
    entries.value.filter((entry) => entry.status === 'done' && entry.uploadResult !== null),
  );
  const processingCount = computed(() => entries.value.filter((entry) => entry.status === 'processing').length);
  const duplicateEntries = computed(() => entries.value.filter((entry) => entry.duplicate));
  const queueCountLabel = computed(() => (hasEntries.value ? `${entries.value.length} 张` : '空'));
  const canSubmit = computed(() => readyEntries.value.length > 0 && !isBatchUploading.value);

  const statusLabel = computed(() => {
    if (globalError.value) return globalError.value;
    if (isBatchUploading.value) {
      const uploadingCount = entries.value.filter((entry) => entry.status === 'uploading').length;
      const total = readyEntries.value.length + uploadingCount + doneEntries.value.length;
      return total > 0 ? `正在上传 ${doneEntries.value.length}/${total}` : '上传中';
    }
    if (processingCount.value > 0) return `处理图片中… ${processingCount.value} 张`;
    const dupCount = duplicateEntries.value.length;
    const dupSuffix = dupCount > 0 ? `，跳过 ${dupCount} 张重复` : '';
    if (canSubmit.value) return `准备就绪，可上传 ${readyEntries.value.length} 张${dupSuffix}`;
    if (hasEntries.value && doneEntries.value.length === entries.value.length) {
      return dupCount > 0 ? `全部完成（${dupCount} 张已存在）` : '全部上传完成';
    }
    if (hasEntries.value) return '等待操作';
    return '等待选择图片';
  });

  const statusVariant = computed<'is-idle' | 'is-busy' | 'is-ok' | 'is-error' | 'is-pending'>(() => {
    if (globalError.value) return 'is-error';
    if (isBatchUploading.value || processingCount.value > 0) return 'is-busy';
    if (hasEntries.value && doneEntries.value.length === entries.value.length) return 'is-ok';
    if (canSubmit.value) return 'is-pending';
    return 'is-idle';
  });

  const uploadTaskTotal = computed(() => {
    const uploadingCount = entries.value.filter((entry) => entry.status === 'uploading').length;
    return Math.max(1, readyEntries.value.length + uploadingCount + doneEntries.value.length);
  });

  const taskProgressMax = computed(() =>
    isBatchUploading.value ? uploadTaskTotal.value : Math.max(1, entries.value.length),
  );

  const taskProgressValue = computed<number | null>(() => {
    if (globalError.value) return null;
    if (isBatchUploading.value) return doneEntries.value.length;
    if (processingCount.value > 0) return entries.value.length - processingCount.value;
    if (hasEntries.value && doneEntries.value.length === entries.value.length) return entries.value.length;
    if (canSubmit.value) return readyEntries.value.length;
    return 0;
  });

  const taskProgressStatus = computed<'idle' | 'loading' | 'success' | 'error'>(() => {
    if (globalError.value) return 'error';
    if (isBatchUploading.value || processingCount.value > 0) return 'loading';
    if (hasEntries.value && doneEntries.value.length === entries.value.length) return 'success';
    if (canSubmit.value) return 'loading';
    return 'idle';
  });

  return {
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
    doneEntries,
    processingCount,
    duplicateEntries,
    queueCountLabel,
    canSubmit,
    statusLabel,
    statusVariant,
    uploadTaskTotal,
    taskProgressMax,
    taskProgressValue,
    taskProgressStatus,
  };
};
