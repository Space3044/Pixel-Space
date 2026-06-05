<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import imageCompression from 'browser-image-compression';
import exifr from 'exifr';

import AppShell from '@/shared/ui/AppShell.vue';
import LocationSearch from '@/features/images/LocationSearch.vue';
import FolderPickerPopover from '@/features/images/FolderPickerPopover.vue';
import { fetchFolders, type FolderRecord } from '@/features/library/library.api';
import { reverseGeocodeLocation, type GeocodeRegion, type GeocodeResult } from '@/features/images/geocode.api';
import type { ImageRecord } from '@/features/images/image.types';
import { formatBytes as formatImageBytes } from '@/features/images/image-meta';
import { checkImageHash } from '@/features/images/images.api';
import type { MapRegion } from './map-coordinate';
import { formatExifTakenAt, normalizeExif } from './exif';
import { createChinaPickAdapter, createWorldPickAdapter, type PickMapAdapter } from './pick-map';
import { previewAiAnnotation } from './ai-preview.api';
import { uploadImage } from './upload.api';
import { buildUploadFormData } from './upload-form';
import type { UploadDimensions, UploadExif, UploadMeta } from './upload.types';

const MAX_ORIGINAL_BYTES = 50 * 1024 * 1024;
const MAX_EDGE = 2048;

type EntryStatus = 'processing' | 'ready' | 'uploading' | 'done' | 'error';
type AiStatus = 'idle' | 'pending' | 'done' | 'failed';
type MapLoadState = 'loading' | 'ready';

interface UploadEntry {
  id: string;
  file: File;
  previewUrl: string | null;
  previewObjectUrl: string | null;
  compressedFile: File | null;
  compressedDimensions: UploadDimensions | null;
  exif: UploadExif;
  meta: UploadMeta;
  status: EntryStatus;
  errorMessage: string | null;
  aiStatus: AiStatus;
  aiError: string | null;
  aiRequestId: number;
  uploadResult: ImageRecord | null;
  duplicate: boolean;
}

const emptyExif = (): UploadExif => ({
  taken_at: null,
  camera: null,
  iso: null,
  aperture: null,
  shutter: null,
  focal_length: null,
  location_lat: null,
  location_lng: null,
});

const createMeta = (file: File): UploadMeta => ({
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

let entryIdSeq = 0;
const nextEntryId = () => `e_${++entryIdSeq}`;

const createEntry = (file: File): UploadEntry => {
  const previewObjectUrl = URL.createObjectURL(file);
  return {
    id: nextEntryId(),
    file,
    previewUrl: previewObjectUrl,
    previewObjectUrl,
    compressedFile: null,
    compressedDimensions: null,
    exif: emptyExif(),
    meta: createMeta(file),
    status: 'processing',
    errorMessage: null,
    aiStatus: 'idle',
    aiError: null,
    aiRequestId: 0,
    uploadResult: null,
    duplicate: false,
  };
};

const fileInputRef = ref<HTMLInputElement | null>(null);
const mapRef = ref<HTMLDivElement | null>(null);

const entries = ref<UploadEntry[]>([]);
const currentEntryId = ref<string | null>(null);
const isBatchUploading = ref(false);
const globalError = ref<string | null>(null);
const mapLoadState = ref<MapLoadState>('loading');

// 整批上传配置：目标文件夹 + 是否把当前图位置自动同步到队列里其它没坐标的图。
const batchFolderId = ref<string>('');
const syncLocation = ref<boolean>(false);
const folders = ref<FolderRecord[]>([]);

let pickAdapter: PickMapAdapter | null = null;
// 取景底图区域跟随位置搜索范围切换。
const pickRegion = ref<GeocodeRegion>('cn');
const regionFromPickRegion = (region: GeocodeRegion): MapRegion => (region === 'cn' ? 'china' : 'global');

const currentEntry = computed(() => entries.value.find((entry) => entry.id === currentEntryId.value) ?? null);
const hasCurrent = computed(() => currentEntry.value !== null);

const emptyEntry = ref<UploadEntry>({
  id: '__placeholder__',
  file: new File([], ''),
  previewUrl: null,
  previewObjectUrl: null,
  compressedFile: null,
  compressedDimensions: null,
  exif: emptyExif(),
  meta: createMeta(new File([], '')),
  status: 'ready',
  errorMessage: null,
  aiStatus: 'idle',
  aiError: null,
  aiRequestId: 0,
  uploadResult: null,
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
const formatBytes = (bytes: number): string => formatImageBytes(bytes, '--');

const originalSize = computed(() => formatBytes(currentEntry.value?.file.size ?? 0));
const compressedSize = computed(() => formatBytes(currentEntry.value?.compressedFile?.size ?? 0));

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

const display = (value: string | number | null): string => {
  if (value === null || value === '') return '--';
  return String(value);
};

const formatFocalLength = (value: number | null): string => {
  if (value === null) return '--';
  return `${Number(value.toFixed(2))} mm`;
};

const releaseEntryPreview = (entry: UploadEntry) => {
  if (entry.previewObjectUrl) {
    URL.revokeObjectURL(entry.previewObjectUrl);
    entry.previewObjectUrl = null;
  }
  entry.previewUrl = null;
};

const currentStoredCoordinate = () => {
  const entry = currentEntry.value;
  const lat = entry?.meta.location_lat ?? null;
  const lng = entry?.meta.location_lng ?? null;
  return lat === null || lng === null ? null : { lng, lat };
};

const syncMarker = (center = false) => {
  pickAdapter?.setMarker(currentStoredCoordinate(), center);
};

const setEntryCoordinates = (entry: UploadEntry, lat: number | null, lng: number | null, centerMap = true) => {
  entry.meta.location_lat = lat;
  entry.meta.location_lng = lng;
  // 坐标来源跟随用户选择的搜索区域，避免海外坐标被国内边界兜底误判。
  entry.meta.location_region = lat === null || lng === null ? null : regionFromPickRegion(pickRegion.value);
  if (entry.id === currentEntryId.value) syncMarker(centerMap);
};

// 把当前选中图的位置广播给目标图：只在同步开关打开、对方还没坐标时才覆盖；
// 地名同样仅在对方留空时拷过去，避免覆盖用户手填的别名。
const broadcastLocationInto = (target: UploadEntry) => {
  if (!syncLocation.value) return;
  const cur = currentEntry.value;
  if (!cur || cur.id === target.id) return;
  if (cur.meta.location_lat === null || cur.meta.location_lng === null) return;
  if (target.meta.location_lat !== null && target.meta.location_lng !== null) return;
  target.meta.location_lat = cur.meta.location_lat;
  target.meta.location_lng = cur.meta.location_lng;
  target.meta.location_region = cur.meta.location_region;
  if (!target.meta.location_name) target.meta.location_name = cur.meta.location_name;
};

const broadcastLocationToAll = () => {
  if (!syncLocation.value) return;
  for (const entry of entries.value) broadcastLocationInto(entry);
};

const loadFolders = async () => {
  try {
    folders.value = await fetchFolders();
  } catch (error) {
    globalError.value = `文件夹加载失败：${(error as Error).message}`;
  }
};

const mountMap = async () => {
  if (!mapRef.value || pickAdapter) return;
  mapLoadState.value = 'loading';
  const adapter = pickRegion.value === 'cn' ? createChinaPickAdapter() : createWorldPickAdapter();
  pickAdapter = adapter;
  await adapter.init(
    mapRef.value,
    () => {
      if (pickAdapter !== adapter) return;
      mapLoadState.value = 'ready';
      adapter.setMarker(currentStoredCoordinate(), false);
    },
    (stored) => {
      const entry = currentEntry.value;
      if (!entry) return;
      setEntryCoordinates(entry, stored.lat, stored.lng, false);
    },
  );
};

// 切换搜索区域时换底图引擎：销毁旧实例、按新区域重建，标记在 onReady 里按当前坐标恢复。
const remountMap = async () => {
  pickAdapter?.destroy();
  pickAdapter = null;
  mapLoadState.value = 'loading';
  await mountMap();
};

const onSearchRegionChange = (region: GeocodeRegion) => {
  const shouldRemount = region !== pickRegion.value;
  pickRegion.value = region;
  const entry = currentEntry.value;
  if (entry && entry.meta.location_lat !== null && entry.meta.location_lng !== null) {
    entry.meta.location_region = regionFromPickRegion(region);
  }
  if (shouldRemount) void remountMap();
};

const readExif = async (file: File): Promise<UploadExif> => {
  const tags = [
    'Make',
    'Model',
    'DateTimeOriginal',
    'CreateDate',
    'ModifyDate',
    'ISO',
    'FNumber',
    'ExposureTime',
    'FocalLength',
    'GPSLatitude',
    'GPSLongitude',
  ];
  const raw = await exifr.parse(file, tags).catch(() => null);
  const gps = await exifr.gps(file).catch(() => null);
  return normalizeExif({ ...(raw ?? {}), ...(gps ?? {}) });
};

const compressToWebp = async (file: File): Promise<File> => {
  const compressed = await imageCompression(file, {
    maxWidthOrHeight: MAX_EDGE,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.86,
    preserveExif: false,
  });

  const outputName = file.name.replace(/\.[^.]+$/, '.webp');
  return new File([compressed], outputName, { type: 'image/webp', lastModified: Date.now() });
};

const sha256HexFromFile = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const readImageDimensions = (file: File): Promise<UploadDimensions> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        reject(new Error('无法读取压缩后图片尺寸。'));
        return;
      }
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('无法读取压缩后图片尺寸。'));
    };

    image.src = objectUrl;
  });

const runAiPreview = async (entry: UploadEntry) => {
  const compressed = entry.compressedFile;
  if (!compressed) return;
  const requestId = ++entry.aiRequestId;
  entry.aiStatus = 'pending';
  entry.aiError = null;
  entry.meta.ai_status = 'pending';

  try {
    const result = await previewAiAnnotation(compressed);
    if (requestId !== entry.aiRequestId) return;

    entry.meta.title = result.title || entry.meta.title;
    entry.meta.caption = result.caption;
    entry.meta.tags = result.tags.join(', ');
    entry.meta.search_content = result.search_content;
    entry.meta.dominant_color = result.dominant_color;
    entry.meta.palette = result.palette.join(', ');
    entry.meta.composition = result.composition;
    entry.meta.ai_status = 'done';
    entry.aiStatus = 'done';
  } catch (error) {
    if (requestId !== entry.aiRequestId) return;
    entry.aiError = (error as Error).message || 'AI 分析失败。';
    entry.meta.ai_status = 'failed';
    entry.aiStatus = 'failed';
  }
};

const processEntry = async (entry: UploadEntry) => {
  try {
    const hash = await sha256HexFromFile(entry.file);
    const existing = await checkImageHash(hash);
    if (existing) {
      entry.uploadResult = existing;
      entry.duplicate = true;
      entry.status = 'done';
      entry.aiStatus = 'idle';
      entry.meta.ai_status = 'done';
      return;
    }

    const nextExif = await readExif(entry.file);
    const nextCompressed = await compressToWebp(entry.file);
    const nextDimensions = await readImageDimensions(nextCompressed);
    entry.exif = nextExif;
    entry.compressedFile = nextCompressed;
    entry.compressedDimensions = nextDimensions;
    if (nextExif.location_lat !== null && nextExif.location_lng !== null) {
      setEntryCoordinates(entry, nextExif.location_lat, nextExif.location_lng, entry.id === currentEntryId.value);
      if (!entry.meta.location_name) {
        void reverseGeocodeLocation(nextExif.location_lat, nextExif.location_lng).then((name) => {
          if (name && !entry.meta.location_name) entry.meta.location_name = name;
        });
      }
    }
    entry.status = 'ready';
    enqueueAi(entry);
    broadcastLocationInto(entry);
  } catch (error) {
    entry.status = 'error';
    entry.errorMessage = (error as Error).message || '图片处理失败。';
  }
};

const processQueue: UploadEntry[] = [];
let processBusy = false;

const runProcessLoop = async () => {
  if (processBusy) return;
  processBusy = true;
  try {
    while (processQueue.length > 0) {
      const queued = processQueue.shift()!;
      const live = entries.value.find((e) => e.id === queued.id);
      if (!live) continue;
      await processEntry(live);
    }
  } finally {
    processBusy = false;
  }
};

const enqueueProcess = (entry: UploadEntry) => {
  processQueue.push(entry);
  void runProcessLoop();
};

const aiQueue: UploadEntry[] = [];
let aiBusy = false;

const runAiLoop = async () => {
  if (aiBusy) return;
  aiBusy = true;
  try {
    while (aiQueue.length > 0) {
      const queued = aiQueue.shift()!;
      const live = entries.value.find((e) => e.id === queued.id);
      if (!live || !live.compressedFile) continue;
      await runAiPreview(live);
    }
  } finally {
    aiBusy = false;
  }
};

const enqueueAi = (entry: UploadEntry) => {
  aiQueue.push(entry);
  void runAiLoop();
};

const addFiles = (files: File[]) => {
  globalError.value = null;
  const accepted: UploadEntry[] = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      globalError.value = `已跳过非图片文件：${file.name}`;
      continue;
    }
    if (file.size > MAX_ORIGINAL_BYTES) {
      globalError.value = `已跳过超过 50MB 的文件：${file.name}`;
      continue;
    }
    const entry = createEntry(file);
    entries.value.push(entry);
    accepted.push(entry);
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
  if (currentEntryId.value === entryId) return;
  currentEntryId.value = entryId;
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
};

const clearAll = () => {
  for (const entry of entries.value) releaseEntryPreview(entry);
  entries.value = [];
  currentEntryId.value = null;
  globalError.value = null;
};

const updateLat = (event: Event) => {
  const entry = currentEntry.value;
  if (!entry) return;
  const value = (event.target as HTMLInputElement).value;
  const lat = Number(value);
  setEntryCoordinates(
    entry,
    value === '' || !Number.isFinite(lat) ? null : lat,
    entry.meta.location_lng,
    false,
  );
};

const updateLng = (event: Event) => {
  const entry = currentEntry.value;
  if (!entry) return;
  const value = (event.target as HTMLInputElement).value;
  const lng = Number(value);
  setEntryCoordinates(
    entry,
    entry.meta.location_lat,
    value === '' || !Number.isFinite(lng) ? null : lng,
    false,
  );
};

const clearLocation = () => {
  const entry = currentEntry.value;
  if (!entry) return;
  entry.meta.location_name = '';
  setEntryCoordinates(entry, null, null, false);
};

const setIsPublic = (entry: UploadEntry, checked: boolean) => {
  entry.meta.is_public = checked ? 1 : 0;
};

const setLocationPublic = (entry: UploadEntry, checked: boolean) => {
  entry.meta.location_public = checked ? 1 : 0;
};

const applyLocationSearchResult = (result: GeocodeResult) => {
  const entry = currentEntry.value;
  if (!entry) return;
  entry.meta.location_name = result.name;
  setEntryCoordinates(entry, result.lat, result.lng, true);
};

const triggerAiForCurrent = () => {
  const entry = currentEntry.value;
  if (!entry || !entry.compressedFile) return;
  enqueueAi(entry);
};

const uploadEntry = async (entry: UploadEntry) => {
  if (!entry.compressedFile || !entry.compressedDimensions) return;
  const formData = buildUploadFormData({
    original: entry.file,
    compressed: entry.compressedFile,
    exif: entry.exif,
    meta: { ...entry.meta, folder_id: batchFolderId.value || null },
    dimensions: entry.compressedDimensions,
  });

  entry.status = 'uploading';
  entry.errorMessage = null;
  try {
    const record = await uploadImage(formData);
    entry.uploadResult = record;
    entry.status = 'done';
  } catch (error) {
    entry.errorMessage = (error as Error).message || '上传失败。';
    entry.status = 'error';
  }
};

const submitUploadAll = async () => {
  if (!canSubmit.value) return;
  isBatchUploading.value = true;
  globalError.value = null;
  try {
    for (const entry of entries.value) {
      if (entry.status !== 'ready') continue;
      await uploadEntry(entry);
    }
  } finally {
    isBatchUploading.value = false;
  }
};

watch(currentEntryId, () => {
  void nextTick(() => {
    if (!pickAdapter) {
      void mountMap();
      return;
    }
    syncMarker(true);
    pickAdapter.resize();
  });
});

watch(
  () => currentEntry.value?.meta.location_lat,
  () => {
    syncMarker(false);
    broadcastLocationToAll();
  },
);
watch(
  () => currentEntry.value?.meta.location_lng,
  () => {
    syncMarker(false);
    broadcastLocationToAll();
  },
);
watch(
  () => currentEntry.value?.meta.location_name,
  () => broadcastLocationToAll(),
);
watch(syncLocation, (val) => {
  if (val) broadcastLocationToAll();
});

onMounted(() => {
  void mountMap();
  void loadFolders();
});

onBeforeUnmount(() => {
  for (const entry of entries.value) releaseEntryPreview(entry);
  pickAdapter?.destroy();
  pickAdapter = null;
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

        <div class="action-row">
          <button
            type="button"
            class="drop-zone"
            :class="{ 'is-compact': hasEntries }"
            @click="openFilePicker"
            @dragover.prevent
            @drop.prevent="handleDrop"
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
              <span class="state-dot" aria-hidden="true" />
              <span class="status-text">{{ statusLabel }}</span>
              <button
                type="button"
                class="cyber-button submit-button"
                aria-label="上传图片"
                :disabled="!canSubmit"
                @click="submitUploadAll"
              >
                {{ isBatchUploading ? '上传中' : `上传 ${readyEntries.length || ''} 张`.trim() }}
              </button>
            </aside>
          </div>
        </div>

        <div
          v-if="globalError"
          class="error-banner"
          role="alert"
        >
          <span aria-hidden="true" class="error-icon">!</span>
          <span>{{ globalError }}</span>
        </div>

        <div class="workbench">
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
                  @click="selectEntry(entry.id)"
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
                  <span v-else-if="entry.status === 'done'" class="thumb-badge is-ok">已上传</span>
                  <span v-else-if="entry.status === 'error'" class="thumb-badge is-error">失败</span>
                </button>
                <button
                  type="button"
                  class="thumb-remove"
                  aria-label="从队列中移除"
                  @click.stop="removeEntry(entry.id)"
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
                @click="openFilePicker"
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
              @click="clearAll"
            >
              清空队列
            </button>
          </aside>

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
                <span v-else-if="currentEntry.status === 'done'" class="preview-ok">已上传</span>
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

          <aside class="meta-sidebar cyber-panel">
            <section class="meta-section">
              <header class="meta-section-title">
                <svg viewBox="0 0 384 512" fill="currentColor" aria-hidden="true"><path d="M0 64C0 28.7 28.7 0 64 0H224V128c0 17.7 14.3 32 32 32H384V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V64zm384 64H256V0L384 128z" /></svg>
                <span>文件</span>
              </header>
              <dl class="meta-list">
                <div class="meta-row">
                  <dt>文件名</dt>
                  <dd class="truncate font-mono">{{ displayFileName }}</dd>
                </div>
                <div class="meta-row">
                  <dt>原始大小</dt>
                  <dd class="font-mono">{{ originalSize }}</dd>
                </div>
                <div class="meta-row">
                  <dt>压缩后</dt>
                  <dd class="font-mono">{{ compressedSize }}</dd>
                </div>
              </dl>
            </section>

            <section class="meta-section">
              <header class="meta-section-title">
                <svg viewBox="0 0 512 512" fill="currentColor" aria-hidden="true"><path d="M149.1 64.8L138.7 96H64C28.7 96 0 124.7 0 160V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H373.3L362.9 64.8C356.4 45.2 338.1 32 317.4 32H194.6c-20.7 0-39 13.2-45.5 32.8zM256 192a96 96 0 1 1 0 192 96 96 0 1 1 0-192z" /></svg>
                <span>EXIF</span>
              </header>
              <dl class="exif-grid">
                <div class="meta-row exif-row-wide">
                  <dt>拍摄时间</dt>
                  <dd class="font-mono">{{ formatExifTakenAt(displayEntry.exif.taken_at) }}</dd>
                </div>
                <div class="meta-row exif-row-wide">
                  <dt>相机</dt>
                  <dd class="font-mono truncate">{{ display(displayEntry.exif.camera) }}</dd>
                </div>
                <div class="meta-row">
                  <dt>ISO</dt>
                  <dd class="font-mono">{{ display(displayEntry.exif.iso) }}</dd>
                </div>
                <div class="meta-row">
                  <dt>快门</dt>
                  <dd class="font-mono">{{ display(displayEntry.exif.shutter) }}</dd>
                </div>
                <div class="meta-row">
                  <dt>光圈</dt>
                  <dd class="font-mono">{{ displayEntry.exif.aperture === null ? '--' : `f/${displayEntry.exif.aperture}` }}</dd>
                </div>
                <div class="meta-row">
                  <dt>焦距</dt>
                  <dd class="font-mono">{{ formatFocalLength(displayEntry.exif.focal_length) }}</dd>
                </div>
              </dl>
            </section>

            <section class="meta-section meta-section-visibility">
              <header class="meta-section-title">
                <svg viewBox="0 0 576 512" fill="currentColor" aria-hidden="true"><path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM432 256A144 144 0 1 1 144 256a144 144 0 1 1 288 0zM288 192c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z" /></svg>
                <span>可见性</span>
              </header>
              <label
                class="visibility-toggle"
                :class="{ 'is-on': displayEntry.meta.is_public === 1, 'is-disabled': !hasCurrent }"
              >
                <span class="visibility-toggle-text">
                  <span class="visibility-toggle-title">公开到探索</span>
                  <span class="visibility-toggle-hint">
                    {{
                      displayEntry.meta.is_public === 1
                        ? '会出现在图库、随机和足迹等公开聚合视图'
                        : '私藏，仅凭直链可见，不进入任何公开聚合'
                    }}
                  </span>
                </span>
                <input
                  type="checkbox"
                  class="visibility-toggle-input"
                  :checked="displayEntry.meta.is_public === 1"
                  :disabled="!hasCurrent"
                  @change="setIsPublic(displayEntry, ($event.target as HTMLInputElement).checked)"
                />
                <span class="visibility-toggle-switch" aria-hidden="true"></span>
              </label>
            </section>

            <section class="meta-section meta-section-form">
              <header class="meta-section-title meta-section-title-pink form-header">
                <span class="form-title">
                  <svg viewBox="0 0 512 512" fill="currentColor" aria-hidden="true"><path d="M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L362.3 51.7l97.9 97.9 30.1-30.1c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.7 15.7-7.4 21.9-13.5L437.7 172.3 339.7 74.3 172.4 241.7zM96 64C43 64 0 107 0 160V416c0 53 43 96 96 96H352c53 0 96-43 96-96V320c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V160c0-17.7 14.3-32 32-32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H96z" /></svg>
                  <span>当前图片信息</span>
                </span>
                <button
                  type="button"
                  class="ai-preview-button"
                  :disabled="!currentEntry?.compressedFile || currentEntry?.aiStatus === 'pending'"
                  @click="triggerAiForCurrent"
                >
                  {{ currentEntry?.aiStatus === 'pending' ? 'AI 分析中' : '重新 AI 分析' }}
                </button>
              </header>
              <p v-if="currentEntry?.aiError" class="ai-error">{{ currentEntry.aiError }}</p>
              <label class="field">
                <span class="field-label">标题</span>
                <input v-model="displayEntry.meta.title" type="text" class="cyber-input" :disabled="!hasCurrent" />
              </label>
              <label class="field">
                <span class="field-label">描述</span>
                <textarea v-model="displayEntry.meta.caption" rows="3" class="cyber-input" :disabled="!hasCurrent"></textarea>
              </label>
              <label class="field">
                <span class="field-label">标签</span>
                <input
                  v-model="displayEntry.meta.tags"
                  type="text"
                  class="cyber-input"
                  placeholder="用逗号分隔，例如：猫, 夜景"
                  :disabled="!hasCurrent"
                />
              </label>
              <label class="field">
                <span class="field-label">主色调</span>
                <input
                  v-model="displayEntry.meta.dominant_color"
                  type="text"
                  class="cyber-input"
                  placeholder="例如：暮光橙 #F59E0B"
                  :disabled="!hasCurrent"
                />
              </label>
              <label class="field">
                <span class="field-label">色板</span>
                <input
                  v-model="displayEntry.meta.palette"
                  type="text"
                  class="cyber-input"
                  placeholder="用逗号分隔，例如：#F59E0B, #0F172A"
                  :disabled="!hasCurrent"
                />
              </label>
              <label class="field">
                <span class="field-label">构图</span>
                <textarea v-model="displayEntry.meta.composition" rows="2" class="cyber-input" :disabled="!hasCurrent"></textarea>
              </label>
              <label class="field">
                <span class="field-label">搜索文本</span>
                <textarea v-model="displayEntry.meta.search_content" rows="2" class="cyber-input" :disabled="!hasCurrent"></textarea>
              </label>
              <label class="field">
                <span class="field-label">位置名称</span>
                <input
                  v-model="displayEntry.meta.location_name"
                  type="text"
                  class="cyber-input"
                  placeholder="例如：上海 外滩"
                  :disabled="!hasCurrent"
                />
              </label>

              <div class="map-block">
                <div class="map-block-header">
                  <span class="field-label">地图坐标</span>
                  <label
                    class="visibility-inline"
                    :class="{
                      'is-on': displayEntry.meta.location_public === 1,
                      'is-disabled':
                        !hasCurrent ||
                        displayEntry.meta.location_lat === null ||
                        displayEntry.meta.location_lng === null,
                    }"
                    :title="
                      !hasCurrent
                        ? '请先选择图片'
                        : displayEntry.meta.location_lat === null || displayEntry.meta.location_lng === null
                          ? '未设置坐标'
                          : displayEntry.meta.location_public === 1
                            ? '访客可见地名和地图标记'
                            : '访客只看到空地图'
                    "
                  >
                    <span class="visibility-inline-label">公开显示位置</span>
                    <input
                      type="checkbox"
                      class="visibility-toggle-input"
                      :checked="displayEntry.meta.location_public === 1"
                      :disabled="
                        !hasCurrent ||
                        displayEntry.meta.location_lat === null ||
                        displayEntry.meta.location_lng === null
                      "
                      @change="setLocationPublic(displayEntry, ($event.target as HTMLInputElement).checked)"
                    />
                    <span class="visibility-inline-switch" aria-hidden="true"></span>
                  </label>
                  <button
                    type="button"
                    class="map-clear"
                    :disabled="!hasCurrent"
                    @click="clearLocation"
                  >
                    清空
                  </button>
                </div>
                <LocationSearch
                  :model-value="pickRegion"
                  class="location-search"
                  @select="applyLocationSearchResult"
                  @region-change="onSearchRegionChange"
                />
                <div ref="mapRef" class="map-pane" aria-label="点击地图选择图片位置"></div>
                <p v-if="mapLoadState !== 'ready'" class="map-status">
                  正在加载地图
                </p>
                <div class="map-coords">
                  <label class="field">
                    <span class="field-sublabel">纬度</span>
                    <input
                      type="number"
                      step="0.000001"
                      class="cyber-input"
                      :value="displayEntry.meta.location_lat ?? ''"
                      :disabled="!hasCurrent"
                      @input="updateLat"
                    />
                  </label>
                  <label class="field">
                    <span class="field-sublabel">经度</span>
                    <input
                      type="number"
                      step="0.000001"
                      class="cyber-input"
                      :value="displayEntry.meta.location_lng ?? ''"
                      :disabled="!hasCurrent"
                      @input="updateLng"
                    />
                  </label>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </section>
  </AppShell>
</template>

<style scoped>
.upload-page {
  position: relative;
  isolation: isolate;
  overflow-x: clip;
  margin-left: -0.75rem;
  margin-right: -0.75rem;
}

@media (min-width: 640px) {
  .upload-page {
    margin-left: -1rem;
    margin-right: -1rem;
  }
}

.orbs {
  position: absolute;
  inset: -4rem -1rem auto -1rem;
  height: 28rem;
  pointer-events: none;
  z-index: 0;
}

.orb {
  position: absolute;
  width: 22rem;
  height: 22rem;
  border-radius: 0.5rem;
  filter: blur(80px);
  opacity: 0.18;
}

.orb-cyan {
  top: -4rem;
  left: -6rem;
  background: rgb(53, 243, 255);
}

.orb-pink {
  top: -2rem;
  right: -6rem;
  background: rgb(255, 79, 216);
}

.page-inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 0.75rem 1rem 2rem;
}

@media (min-width: 640px) {
  .page-inner {
    padding-left: 1.25rem;
    padding-right: 1.25rem;
  }
}

.action-row {
  position: relative;
  z-index: 20;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  align-items: stretch;
}

@media (min-width: 900px) {
  .action-row {
    grid-template-columns: minmax(0, 1fr) minmax(20rem, 24rem);
  }
}

.drop-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  width: 100%;
  padding: 1.25rem 1.5rem;
  border-radius: 0.6rem;
  border: 1.5px dashed rgba(255, 255, 255, 0.16);
  background: rgba(7, 7, 19, 0.45);
  backdrop-filter: blur(12px);
  text-align: center;
  cursor: pointer;
  transition: all 0.25s ease;
}
.drop-zone:hover {
  border-color: rgba(53, 243, 255, 0.55);
  background: rgba(53, 243, 255, 0.05);
  box-shadow: 0 0 28px rgba(53, 243, 255, 0.14);
  transform: translateY(-1px);
}
.drop-zone.is-compact {
  padding: 0.9rem 1.25rem;
}

.drop-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 3rem;
  height: 3rem;
  border-radius: 0.45rem;
  border: 1px solid rgba(53, 243, 255, 0.3);
  background: rgba(53, 243, 255, 0.08);
  color: rgb(53, 243, 255);
}
.drop-icon svg {
  width: 1.25rem;
  height: 1.25rem;
}
.drop-zone.is-compact .drop-icon {
  width: 2.25rem;
  height: 2.25rem;
}
.drop-zone.is-compact .drop-icon svg {
  width: 1rem;
  height: 1rem;
}

.drop-text {
  min-width: 0;
}

.drop-title {
  font-size: 0.92rem;
  font-weight: 700;
  color: rgb(255, 255, 255);
}
.drop-hint {
  margin-top: 0.2rem;
  font-size: 0.74rem;
  color: rgb(148, 163, 184);
}

.action-stack {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 0;
}

.options-pill {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem 1rem;
  padding: 0.6rem 0.85rem;
  border-radius: 0.6rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015)),
    rgba(7, 10, 24, 0.45);
  backdrop-filter: blur(16px) saturate(160%);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
}

.options-cell {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.options-cell:first-of-type {
  flex: 1 1 auto;
}

.options-cell + .options-cell {
  flex-shrink: 0;
  padding-left: 1rem;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
}

.options-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: rgba(165, 243, 252, 0.85);
}

.options-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: rgb(203, 213, 225);
  white-space: nowrap;
  flex-shrink: 0;
}

.options-cell :deep(.folder-trigger) {
  height: 32px;
  padding: 0 0.7rem;
  border-color: rgba(53, 243, 255, 0.55);
  background: linear-gradient(135deg, rgba(53, 243, 255, 0.22), rgba(255, 79, 216, 0.18));
  color: white;
  font-size: 0.76rem;
}

.options-cell :deep(.folder-trigger:hover),
.options-cell :deep(.folder-trigger:focus-visible),
.options-cell :deep(.folder-trigger.active) {
  border-color: rgba(53, 243, 255, 0.95);
  box-shadow: 0 0 18px rgba(53, 243, 255, 0.22);
  color: white;
}

.options-cell :deep(.folder-trigger .folder-icon),
.options-cell :deep(.folder-trigger .folder-caret) {
  color: rgba(241, 245, 249, 0.9);
}

.sync-toggle {
  cursor: pointer;
  user-select: none;
  transition: color 160ms ease;
}

.sync-toggle:hover .options-label,
.sync-toggle.is-on .options-label {
  color: rgb(165, 243, 252);
}

.sync-toggle.is-on .options-icon {
  color: rgb(53, 243, 255);
}

.sync-input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
  pointer-events: none;
}

.sync-switch {
  position: relative;
  margin-left: auto;
  flex-shrink: 0;
  width: 1.85rem;
  height: 1rem;
  border-radius: 0.5rem;
  background: rgba(148, 163, 184, 0.35);
  transition: background-color 160ms ease;
}

.sync-switch::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 0.15rem;
  width: 0.72rem;
  height: 0.72rem;
  border-radius: 50%;
  background: rgb(248, 250, 252);
  transform: translateY(-50%);
  transition: left 160ms ease;
}

.sync-toggle.is-on .sync-switch {
  background: rgba(53, 243, 255, 0.7);
}

.sync-toggle.is-on .sync-switch::after {
  left: 0.96rem;
}

.action-pill {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.7rem 1rem;
  border-radius: 0.6rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02)),
    rgba(7, 10, 24, 0.45);
  backdrop-filter: blur(16px) saturate(160%);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
}

.action-pill .state-dot {
  flex-shrink: 0;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: rgba(148, 163, 184, 0.6);
  box-shadow: 0 0 8px rgba(148, 163, 184, 0.4);
}
.action-pill.is-busy .state-dot {
  background: rgb(53, 243, 255);
  box-shadow: 0 0 10px rgba(53, 243, 255, 0.55);
  animation: pulse-dot 1.4s ease-in-out infinite;
}
.action-pill.is-pending .state-dot {
  background: rgb(255, 232, 156);
  box-shadow: 0 0 10px rgba(255, 232, 156, 0.5);
}
.action-pill.is-ok .state-dot {
  background: rgb(132, 247, 153);
  box-shadow: 0 0 10px rgba(132, 247, 153, 0.5);
}
.action-pill.is-error .state-dot {
  background: rgb(248, 113, 113);
  box-shadow: 0 0 10px rgba(248, 113, 113, 0.5);
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.action-pill .status-text {
  flex: 1;
  min-width: 0;
  font-size: 0.78rem;
  color: rgb(203, 213, 225);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.submit-button {
  flex-shrink: 0;
  border-radius: 0.45rem;
  min-height: 2.4rem;
  padding: 0 1rem;
  font-size: 0.78rem;
}

.upload-page .cyber-input,
.upload-page .cyber-button {
  border-radius: 0.45rem;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(248, 113, 113, 0.35);
  background: rgba(244, 63, 94, 0.08);
  color: rgb(254, 205, 211);
  font-size: 0.85rem;
}
.error-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 50%;
  background: rgba(248, 113, 113, 0.2);
  color: rgb(254, 226, 226);
  font-weight: 700;
}

.workbench {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  min-height: 0;
}

@media (min-width: 1024px) {
  .workbench {
    height: clamp(32rem, calc(100svh - 13rem), 46rem);
    grid-template-columns: 8.5rem minmax(0, 1fr) 24rem;
    align-items: stretch;
  }
}

.queue-rail {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.6rem;
  overflow: hidden;
  border-radius: 0.6rem;
  padding: 0.85rem;
}

.queue-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0 0.1rem 0.55rem;
  border-bottom: 1px solid rgba(53, 243, 255, 0.12);
}

.section-eyebrow {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: rgb(53, 243, 255);
}
.section-count {
  flex-shrink: 0;
  padding: 0.12rem 0.45rem;
  border-radius: 0.35rem;
  border: 1px solid rgba(53, 243, 255, 0.18);
  background: rgba(53, 243, 255, 0.06);
  font-size: 10.5px;
  font-family: 'Menlo', 'Consolas', monospace;
  line-height: 1.35;
  color: rgb(203, 213, 225);
  white-space: nowrap;
}

.queue-list {
  display: flex;
  gap: 0.55rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
  flex: 1;
  min-height: 0;
}

@media (min-width: 1024px) {
  .queue-list {
    min-height: 0;
    flex-direction: column;
    align-items: center;
    overflow-x: visible;
    overflow-y: auto;
    padding-right: 0.25rem;
  }
}

.thumb-cell {
  position: relative;
  flex: 0 0 5.25rem;
  width: 5.25rem;
}

.thumb {
  position: relative;
  display: block;
  aspect-ratio: 1 / 1;
  width: 100%;
  overflow: hidden;
  border-radius: 0.45rem;
  background: rgba(7, 7, 19, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.2s ease;
  cursor: pointer;
}
.thumb:hover {
  border-color: rgba(53, 243, 255, 0.4);
  transform: translateY(-1px);
}
.thumb.is-active {
  border-color: rgb(53, 243, 255);
  box-shadow: 0 0 14px rgba(53, 243, 255, 0.35);
}
.thumb.is-busy::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(7, 10, 24, 0.45);
  pointer-events: none;
}
.thumb.is-done {
  border-color: rgba(132, 247, 153, 0.55);
}
.thumb.is-error {
  border-color: rgba(248, 113, 113, 0.55);
}

.thumb-badge {
  position: absolute;
  left: 4px;
  bottom: 4px;
  padding: 0.08rem 0.32rem;
  border-radius: 0.25rem;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.04em;
  white-space: nowrap;
  z-index: 1;
}
.thumb-badge.is-busy {
  background: rgba(7, 10, 24, 0.85);
  color: rgb(53, 243, 255);
  border: 1px solid rgba(53, 243, 255, 0.42);
}
.thumb-badge.is-ok {
  background: rgba(7, 10, 24, 0.85);
  color: rgb(132, 247, 153);
  border: 1px solid rgba(132, 247, 153, 0.42);
}
.thumb-badge.is-dup {
  background: rgba(7, 10, 24, 0.85);
  color: rgb(251, 191, 36);
  border: 1px solid rgba(251, 191, 36, 0.45);
}
.thumb-badge.is-error {
  background: rgba(7, 10, 24, 0.85);
  color: rgb(248, 113, 113);
  border: 1px solid rgba(248, 113, 113, 0.42);
}

.thumb-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  background: rgb(7, 7, 19);
  border: 1px solid rgba(255, 79, 216, 0.55);
  color: rgb(255, 79, 216);
  cursor: pointer;
  opacity: 0;
  transform: scale(0.85);
  transition: opacity 0.2s ease, transform 0.2s ease, background 0.2s ease;
  z-index: 2;
}
.thumb-cell:hover .thumb-remove,
.thumb-remove:focus-visible {
  opacity: 1;
  transform: scale(1);
}
.thumb-remove:hover {
  background: rgb(255, 79, 216);
  color: rgb(7, 7, 19);
  box-shadow: 0 0 12px rgba(255, 79, 216, 0.55);
}
.thumb-remove svg {
  width: 0.55rem;
  height: 0.55rem;
}

.thumb-empty {
  flex: 0 0 5.25rem;
  aspect-ratio: 1 / 1;
  width: 5.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.45rem;
  border: 1.5px dashed rgba(255, 255, 255, 0.18);
  background: transparent;
  color: rgba(148, 163, 184, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
}
.thumb-empty:hover {
  border-color: rgba(53, 243, 255, 0.5);
  color: rgb(53, 243, 255);
}
.thumb-empty svg {
  width: 1rem;
  height: 1rem;
}

.queue-clear {
  flex-shrink: 0;
  align-self: stretch;
  padding: 0.32rem 0.45rem;
  border-radius: 0.35rem;
  border: 1px solid rgba(255, 79, 216, 0.22);
  background: rgba(255, 79, 216, 0.06);
  color: rgb(244, 194, 255);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
}
.queue-clear:hover:not(:disabled) {
  border-color: rgba(255, 79, 216, 0.5);
  background: rgba(255, 79, 216, 0.12);
  color: white;
}
.queue-clear:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.preview-stage {
  position: relative;
  min-height: 30rem;
  overflow: hidden;
  border-radius: 0.6rem;
}

.preview-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: rgba(7, 7, 19, 0.7);
}

.preview-caption {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 1rem;
  font-size: 11px;
  font-family: 'Menlo', 'Consolas', monospace;
  background: linear-gradient(180deg, rgba(7, 7, 19, 0) 0%, rgba(7, 7, 19, 0.85) 100%);
  color: rgb(148, 163, 184);
  z-index: 1;
}
.preview-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgb(226, 232, 240);
}
.preview-busy {
  color: rgb(53, 243, 255);
}
.preview-ok {
  color: rgb(132, 247, 153);
}
.preview-dup {
  color: rgb(251, 191, 36);
}
.preview-error {
  color: rgb(248, 113, 113);
}

.preview-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  color: rgb(148, 163, 184);
  font-size: 0.85rem;
  z-index: 1;
}

@media (min-width: 1024px) {
  .preview-stage {
    height: 100%;
    min-height: 0;
  }
}

.meta-sidebar {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 1.1rem;
  border-radius: 0.6rem;
}

.meta-placeholder {
  margin: auto 0;
  text-align: center;
  font-size: 0.85rem;
  color: rgb(148, 163, 184);
}

.meta-sidebar :deep(.cyber-input:disabled),
.meta-sidebar :deep(input:disabled),
.meta-sidebar :deep(textarea:disabled) {
  opacity: 0.55;
  cursor: not-allowed;
}
.meta-sidebar .map-clear:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.queue-list,
.meta-sidebar {
  scrollbar-width: thin;
  scrollbar-color: rgba(53, 243, 255, 0.48) rgba(7, 7, 19, 0.24);
}

.queue-list::-webkit-scrollbar,
.meta-sidebar::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}

.queue-list::-webkit-scrollbar-track,
.meta-sidebar::-webkit-scrollbar-track {
  border-radius: 0.35rem;
  background: rgba(7, 7, 19, 0.32);
}

.queue-list::-webkit-scrollbar-thumb,
.meta-sidebar::-webkit-scrollbar-thumb {
  border: 1px solid rgba(53, 243, 255, 0.2);
  border-radius: 0.35rem;
  background: linear-gradient(180deg, rgba(53, 243, 255, 0.62), rgba(255, 79, 216, 0.42));
}

.queue-list::-webkit-scrollbar-thumb:hover,
.meta-sidebar::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(53, 243, 255, 0.82), rgba(255, 79, 216, 0.58));
}

.meta-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.meta-section + .meta-section {
  padding-top: 0.85rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.meta-section-form {
  gap: 0.55rem;
}

.meta-section-form .field {
  gap: 0.22rem;
}

.meta-section-form .field-label {
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: rgb(148, 163, 184);
}

.meta-section-form .field-sublabel {
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: rgba(148, 163, 184, 0.82);
}

.meta-section-form :deep(.cyber-input) {
  min-height: 32px;
  padding: 0.4rem 0.6rem;
  border-radius: 0.4rem;
  font-size: 12px;
  line-height: 1.4;
}

.meta-section-form :deep(textarea.cyber-input) {
  min-height: 0;
  padding: 0.45rem 0.6rem;
  line-height: 1.45;
}

.meta-section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: rgb(53, 243, 255);
}
.meta-section-title svg {
  width: 12px;
  height: 12px;
  color: rgb(103, 232, 249);
}
.meta-section-title-pink {
  color: rgb(255, 79, 216);
}
.meta-section-title-pink svg {
  color: rgb(255, 79, 216);
}

.form-header {
  justify-content: space-between;
  gap: 0.5rem;
}

.form-title {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.ai-preview-button {
  flex-shrink: 0;
  min-height: 1.55rem;
  padding: 0.18rem 0.5rem;
  border-radius: 0.35rem;
  border: 1px solid rgba(255, 79, 216, 0.26);
  background: rgba(255, 79, 216, 0.08);
  color: rgb(244, 194, 255);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
}

.ai-preview-button:hover:not(:disabled) {
  border-color: rgba(255, 79, 216, 0.58);
  background: rgba(255, 79, 216, 0.14);
  color: rgb(255, 255, 255);
}

.ai-preview-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.ai-error {
  padding: 0.4rem 0.55rem;
  border-radius: 0.4rem;
  border: 1px solid rgba(248, 113, 113, 0.26);
  background: rgba(248, 113, 113, 0.08);
  color: rgb(254, 205, 211);
  font-size: 11px;
}

.meta-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.exif-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.3rem 0.6rem;
}

.exif-row-wide {
  grid-column: 1 / -1;
}

.meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.35rem 0.55rem;
  border-radius: 0.4rem;
  background: rgba(7, 7, 19, 0.45);
  border: 1px solid rgba(53, 243, 255, 0.08);
  font-size: 11.5px;
}
.meta-row dt {
  flex-shrink: 0;
  color: rgba(103, 232, 249, 0.7);
  font-weight: 600;
}
.meta-row dd {
  min-width: 0;
  text-align: right;
  color: rgb(226, 232, 240);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.field-label {
  font-size: 12px;
  font-weight: 600;
  color: rgb(203, 213, 225);
}
.field-sublabel {
  font-size: 11px;
  color: rgb(148, 163, 184);
}

.visibility-toggle {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 0.85rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.55rem;
  background: rgba(15, 23, 42, 0.45);
  cursor: pointer;
  transition: border-color 160ms ease, background-color 160ms ease;
}
.visibility-toggle:hover:not(.is-disabled) {
  border-color: rgba(53, 243, 255, 0.35);
}
.visibility-toggle.is-on {
  border-color: rgba(53, 243, 255, 0.45);
  background: rgba(53, 243, 255, 0.06);
}
.visibility-toggle.is-disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.visibility-toggle-text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}
.visibility-toggle-title {
  font-size: 12px;
  font-weight: 600;
  color: rgb(226, 232, 240);
}
.visibility-toggle-hint {
  font-size: 11px;
  color: rgb(148, 163, 184);
  line-height: 1.4;
}
.visibility-toggle-input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
  pointer-events: none;
}
.visibility-toggle-switch {
  position: relative;
  flex-shrink: 0;
  width: 2.4rem;
  height: 1.3rem;
  border-radius: 0.65rem;
  background: rgba(148, 163, 184, 0.35);
  transition: background-color 160ms ease;
}
.visibility-toggle-switch::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 0.15rem;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: rgb(248, 250, 252);
  transform: translateY(-50%);
  transition: left 160ms ease;
}
.visibility-toggle.is-on .visibility-toggle-switch {
  background: rgba(53, 243, 255, 0.7);
}
.visibility-toggle.is-on .visibility-toggle-switch::after {
  left: 1.25rem;
}

.map-block {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.15rem;
  padding-top: 0.55rem;
  border-top: 1px dashed rgba(255, 255, 255, 0.06);
}

.map-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}

.visibility-inline {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-left: auto;
  margin-right: 0.6rem;
  padding: 0.15rem 0.1rem;
  cursor: pointer;
  user-select: none;
}
.visibility-inline.is-disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.visibility-inline-label {
  font-size: 11px;
  color: rgb(148, 163, 184);
  letter-spacing: 0.02em;
}
.visibility-inline.is-on .visibility-inline-label {
  color: rgba(103, 232, 249, 0.95);
}
.visibility-inline-switch {
  position: relative;
  flex-shrink: 0;
  width: 1.8rem;
  height: 0.95rem;
  border-radius: 0.48rem;
  background: rgba(148, 163, 184, 0.35);
  transition: background-color 160ms ease;
}
.visibility-inline-switch::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 0.12rem;
  width: 0.72rem;
  height: 0.72rem;
  border-radius: 50%;
  background: rgb(248, 250, 252);
  transform: translateY(-50%);
  transition: left 160ms ease;
}
.visibility-inline.is-on .visibility-inline-switch {
  background: rgba(53, 243, 255, 0.7);
}
.visibility-inline.is-on .visibility-inline-switch::after {
  left: 0.96rem;
}

.map-clear {
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: rgb(148, 163, 184);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.2s;
}
.map-clear:hover:not(:disabled) {
  color: rgb(53, 243, 255);
}
.map-clear:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.map-pane {
  height: 14rem;
  overflow: hidden;
  border-radius: 0.45rem;
  border: 1px solid rgba(53, 243, 255, 0.2);
  background: rgba(7, 7, 19, 0.72);
}

.map-pane :deep(.amap-container) {
  outline: none;
}

.map-pane :deep(.amap-toolbar),
.map-pane :deep(.amap-scalecontrol) {
  overflow: hidden;
  border: 1px solid rgba(53, 243, 255, 0.24);
  border-radius: 0.4rem;
  background: rgba(7, 7, 19, 0.72);
  box-shadow: 0 0 18px rgba(53, 243, 255, 0.12);
}

.map-pane :deep(.amap-toolbar button) {
  background-color: transparent;
}

.map-pane :deep(.amap-toolbar button:hover) {
  background-color: rgba(53, 243, 255, 0.16);
}

.map-pane :deep(.maplibregl-ctrl-attrib) {
  background: rgba(7, 7, 19, 0.55);
  backdrop-filter: blur(6px);
}

.map-pane :deep(.maplibregl-ctrl-attrib),
.map-pane :deep(.maplibregl-ctrl-attrib a) {
  color: rgba(148, 163, 184, 0.82);
}

.map-pane :deep(.maplibregl-ctrl-scale) {
  border-color: rgba(255, 255, 255, 0.24);
  background: rgba(7, 7, 19, 0.55);
  color: rgba(226, 232, 240, 0.82);
}

.map-pane :deep(.map-marker) {
  --pin-color: rgb(53, 243, 255);
  --pin-glow: rgba(53, 243, 255, 0.48);
}

.map-pane :deep(.map-location-pin) {
  position: relative;
  display: block;
  width: 1.65rem;
  height: 2.15rem;
  filter: drop-shadow(0 0 12px var(--pin-glow));
}

.map-pane :deep(.map-location-pin::before) {
  position: absolute;
  inset: 0.05rem 0.08rem 0.2rem;
  content: '';
  background: linear-gradient(145deg, rgb(255, 255, 255), var(--pin-color) 28%, rgb(8, 145, 178));
  border: 2px solid rgb(255, 255, 255);
  clip-path: polygon(50% 100%, 14% 50%, 14% 20%, 30% 4%, 70% 4%, 86% 20%, 86% 50%);
}

.map-pane :deep(.map-location-pin-dot) {
  position: absolute;
  top: 0.48rem;
  left: 50%;
  width: 0.48rem;
  height: 0.48rem;
  border-radius: 50%;
  background: rgb(255, 255, 255);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.2);
  transform: translateX(-50%);
}

.map-status {
  font-size: 11px;
  color: rgb(148, 163, 184);
}

.map-coords {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
}

</style>
