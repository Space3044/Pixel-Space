<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import imageCompression from 'browser-image-compression';
import exifr from 'exifr';
import type { Map as MapLibreMap, MapMouseEvent, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import AppShell from '@/shared/ui/AppShell.vue';
import LocationSearch from '@/features/images/LocationSearch.vue';
import type { GeocodeResult } from '@/features/images/geocode.api';
import type { ImageRecord } from '@/features/images/image.types';
import { checkImageHash } from '@/features/images/images.api';
import { formatExifTakenAt, normalizeExif } from './exif';
import { MAP_STYLE_URL, RASTER_FALLBACK_STYLE } from './map-style';
import { previewAiAnnotation } from './ai-preview.api';
import { uploadImage } from './upload.api';
import { buildUploadFormData } from './upload-form';
import type { UploadDimensions, UploadExif, UploadMeta } from './upload.types';

const MAX_ORIGINAL_BYTES = 50 * 1024 * 1024;
const MAX_EDGE = 2048;
const DEFAULT_CENTER = { lat: 31.2304, lng: 121.4737 };

type EntryStatus = 'processing' | 'ready' | 'uploading' | 'done' | 'error';
type AiStatus = 'idle' | 'pending' | 'done' | 'failed';
type MapLoadState = 'loading' | 'ready' | 'fallback';

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
  tags: '',
  search_content: '',
  dominant_color: '',
  palette: '',
  composition: '',
  ai_status: 'pending',
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

let map: MapLibreMap | null = null;
let marker: Marker | null = null;
let maplibre: typeof import('maplibre-gl') | null = null;
let usingFallbackStyle = false;

const currentEntry = computed(() => entries.value.find((entry) => entry.id === currentEntryId.value) ?? null);
const hasEntries = computed(() => entries.value.length > 0);
const readyEntries = computed(() => entries.value.filter((entry) => entry.status === 'ready'));
const doneEntries = computed(() =>
  entries.value.filter((entry) => entry.status === 'done' && entry.uploadResult !== null),
);
const processingCount = computed(() => entries.value.filter((entry) => entry.status === 'processing').length);
const duplicateEntries = computed(() => entries.value.filter((entry) => entry.duplicate));
const queueCountLabel = computed(() => (hasEntries.value ? `${entries.value.length} 张` : '空'));
const canSubmit = computed(() => readyEntries.value.length > 0 && !isBatchUploading.value);

const formatBytes = (bytes: number): string => {
  if (bytes <= 0) return '--';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
};

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

const createMapMarkerElement = (): HTMLSpanElement => {
  const element = document.createElement('span');
  element.className = 'map-marker';
  element.setAttribute('aria-hidden', 'true');
  return element;
};

const loadMapLibre = async () => {
  maplibre ??= await import('maplibre-gl');
  return maplibre;
};

const updateMapMarker = (centerMap = false) => {
  if (!map || !maplibre) return;
  const entry = currentEntry.value;
  const lat = entry?.meta.location_lat ?? null;
  const lng = entry?.meta.location_lng ?? null;

  if (lat === null || lng === null) {
    marker?.remove();
    marker = null;
    return;
  }

  const lngLat: [number, number] = [lng, lat];
  if (!marker) {
    marker = new maplibre.Marker({ element: createMapMarkerElement(), anchor: 'center' })
      .setLngLat(lngLat)
      .addTo(map);
  } else {
    marker.setLngLat(lngLat);
  }

  if (centerMap)
    map.easeTo({ center: lngLat, zoom: Math.max(map.getZoom(), 12), duration: 350 });
};

const setEntryCoordinates = (entry: UploadEntry, lat: number | null, lng: number | null, centerMap = true) => {
  entry.meta.location_lat = lat;
  entry.meta.location_lng = lng;
  if (entry.id === currentEntryId.value) updateMapMarker(centerMap);
};

const useRasterFallbackStyle = () => {
  if (!map || usingFallbackStyle) return;
  usingFallbackStyle = true;
  mapLoadState.value = 'fallback';
  map.setStyle(RASTER_FALLBACK_STYLE);
};

const initMap = async () => {
  if (!mapRef.value || map) return;
  const maplibreGl = await loadMapLibre();
  if (!mapRef.value || map) return;

  map = new maplibreGl.Map({
    container: mapRef.value,
    style: MAP_STYLE_URL,
    center: [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat],
    zoom: 9,
    attributionControl: false,
  });
  map.addControl(
    new maplibreGl.NavigationControl({ showCompass: true, showZoom: true }),
    'top-right',
  );

  const fallbackTimer = window.setTimeout(() => {
    if (mapLoadState.value === 'loading') useRasterFallbackStyle();
  }, 5000);

  map.once('idle', () => {
    window.clearTimeout(fallbackTimer);
    if (!usingFallbackStyle) mapLoadState.value = 'ready';
  });

  map.on('error', () => {
    useRasterFallbackStyle();
  });

  map.on('click', (event: MapMouseEvent) => {
    const entry = currentEntry.value;
    if (!entry) return;
    setEntryCoordinates(
      entry,
      Number(event.lngLat.lat.toFixed(6)),
      Number(event.lngLat.lng.toFixed(6)),
      false,
    );
  });
  updateMapMarker(false);
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
    const existing = await checkImageHash(hash).catch(() => null);
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
    }
    entry.status = 'ready';
    enqueueAi(entry);
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
    meta: { ...entry.meta },
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

const startNextUpload = () => {
  openFilePicker();
};

watch(currentEntryId, () => {
  void nextTick(() => {
    if (!map && mapRef.value) {
      void initMap();
      return;
    }
    updateMapMarker(true);
    map?.resize();
  });
});

watch(
  () => currentEntry.value?.meta.location_lat,
  () => updateMapMarker(false),
);
watch(
  () => currentEntry.value?.meta.location_lng,
  () => updateMapMarker(false),
);

onMounted(() => {
  void initMap();
});

onBeforeUnmount(() => {
  for (const entry of entries.value) releaseEntryPreview(entry);
  marker?.remove();
  map?.remove();
  marker = null;
  map = null;
  maplibre = null;
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

          <aside class="action-pill" :class="statusVariant">
            <span class="status-dot" aria-hidden="true" />
            <span class="status-text">{{ statusLabel }}</span>
            <button
              type="button"
              class="cyber-button submit-button"
              :disabled="!canSubmit"
              @click="submitUploadAll"
            >
              {{ isBatchUploading ? '上传中' : `上传 ${readyEntries.length || ''} 张`.trim() }}
            </button>
          </aside>
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
            <template v-if="currentEntry">
              <section class="meta-section">
                <header class="meta-section-title">
                  <svg viewBox="0 0 384 512" fill="currentColor" aria-hidden="true"><path d="M0 64C0 28.7 28.7 0 64 0H224V128c0 17.7 14.3 32 32 32H384V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V64zm384 64H256V0L384 128z" /></svg>
                  <span>文件</span>
                </header>
                <dl class="meta-list">
                  <div class="meta-row">
                    <dt>文件名</dt>
                    <dd class="truncate font-mono">{{ currentEntry.file.name }}</dd>
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
                    <dd class="font-mono">{{ formatExifTakenAt(currentEntry.exif.taken_at) }}</dd>
                  </div>
                  <div class="meta-row exif-row-wide">
                    <dt>相机</dt>
                    <dd class="font-mono truncate">{{ display(currentEntry.exif.camera) }}</dd>
                  </div>
                  <div class="meta-row">
                    <dt>ISO</dt>
                    <dd class="font-mono">{{ display(currentEntry.exif.iso) }}</dd>
                  </div>
                  <div class="meta-row">
                    <dt>快门</dt>
                    <dd class="font-mono">{{ display(currentEntry.exif.shutter) }}</dd>
                  </div>
                  <div class="meta-row">
                    <dt>光圈</dt>
                    <dd class="font-mono">{{ currentEntry.exif.aperture === null ? '--' : `f/${currentEntry.exif.aperture}` }}</dd>
                  </div>
                  <div class="meta-row">
                    <dt>焦距</dt>
                    <dd class="font-mono">{{ formatFocalLength(currentEntry.exif.focal_length) }}</dd>
                  </div>
                </dl>
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
                    :disabled="!currentEntry.compressedFile || currentEntry.aiStatus === 'pending'"
                    @click="triggerAiForCurrent"
                  >
                    {{ currentEntry.aiStatus === 'pending' ? 'AI 分析中' : '重新 AI 分析' }}
                  </button>
                </header>
                <p v-if="currentEntry.aiError" class="ai-error">{{ currentEntry.aiError }}</p>
                <label class="field">
                  <span class="field-label">标题</span>
                  <input v-model="currentEntry.meta.title" type="text" class="cyber-input" />
                </label>
                <label class="field">
                  <span class="field-label">描述</span>
                  <textarea v-model="currentEntry.meta.caption" rows="3" class="cyber-input"></textarea>
                </label>
                <label class="field">
                  <span class="field-label">标签</span>
                  <input
                    v-model="currentEntry.meta.tags"
                    type="text"
                    class="cyber-input"
                    placeholder="用逗号分隔，例如：猫, 夜景"
                  />
                </label>
                <label class="field">
                  <span class="field-label">主色调</span>
                  <input
                    v-model="currentEntry.meta.dominant_color"
                    type="text"
                    class="cyber-input"
                    placeholder="例如：暮光橙 #F59E0B"
                  />
                </label>
                <label class="field">
                  <span class="field-label">色板</span>
                  <input
                    v-model="currentEntry.meta.palette"
                    type="text"
                    class="cyber-input"
                    placeholder="用逗号分隔，例如：#F59E0B, #0F172A"
                  />
                </label>
                <label class="field">
                  <span class="field-label">构图</span>
                  <textarea v-model="currentEntry.meta.composition" rows="2" class="cyber-input"></textarea>
                </label>
                <label class="field">
                  <span class="field-label">搜索文本</span>
                  <textarea v-model="currentEntry.meta.search_content" rows="2" class="cyber-input"></textarea>
                </label>
                <label class="field">
                  <span class="field-label">位置名称</span>
                  <input
                    v-model="currentEntry.meta.location_name"
                    type="text"
                    class="cyber-input"
                    placeholder="例如：上海 外滩"
                  />
                </label>

                <div class="map-block">
                  <div class="map-block-header">
                    <span class="field-label">地图坐标</span>
                    <button
                      type="button"
                      class="map-clear"
                      @click="clearLocation"
                    >
                      清空
                    </button>
                  </div>
                  <LocationSearch class="location-search" @select="applyLocationSearchResult" />
                  <div ref="mapRef" class="map-pane" aria-label="点击地图选择图片位置"></div>
                  <p v-if="mapLoadState !== 'ready'" class="map-status">
                    {{ mapLoadState === 'fallback' ? '矢量地图加载慢，已切到深色备用底图' : '正在加载地图' }}
                  </p>
                  <div class="map-coords">
                    <label class="field">
                      <span class="field-sublabel">纬度</span>
                      <input
                        type="number"
                        step="0.000001"
                        class="cyber-input"
                        :value="currentEntry.meta.location_lat ?? ''"
                        @input="updateLat"
                      />
                    </label>
                    <label class="field">
                      <span class="field-sublabel">经度</span>
                      <input
                        type="number"
                        step="0.000001"
                        class="cyber-input"
                        :value="currentEntry.meta.location_lng ?? ''"
                        @input="updateLng"
                      />
                    </label>
                  </div>
                </div>
              </section>
            </template>
            <template v-else>
              <p class="meta-placeholder">从队列里选一张图片，开始编辑它的元数据喵～</p>
            </template>
          </aside>
        </div>

        <section v-if="doneEntries.length > 0" class="upload-result cyber-panel" aria-live="polite">
          <header class="upload-result-head">
            <div>
              <p class="section-eyebrow">Uploaded</p>
              <h2>已上传 {{ doneEntries.length }} 张</h2>
            </div>
            <button type="button" class="result-action" @click="startNextUpload">
              继续添加图片
            </button>
          </header>
        </section>
      </div>
    </section>
  </AppShell>
</template>

<style scoped>
.upload-page {
  position: relative;
  isolation: isolate;
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
  padding-top: 0.75rem;
  padding-bottom: 2rem;
}

.action-row {
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

.action-pill .status-dot {
  flex-shrink: 0;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: rgba(148, 163, 184, 0.6);
  box-shadow: 0 0 8px rgba(148, 163, 184, 0.4);
}
.action-pill.is-busy .status-dot {
  background: rgb(53, 243, 255);
  box-shadow: 0 0 10px rgba(53, 243, 255, 0.55);
  animation: pulse-dot 1.4s ease-in-out infinite;
}
.action-pill.is-pending .status-dot {
  background: rgb(255, 232, 156);
  box-shadow: 0 0 10px rgba(255, 232, 156, 0.5);
}
.action-pill.is-ok .status-dot {
  background: rgb(132, 247, 153);
  box-shadow: 0 0 10px rgba(132, 247, 153, 0.5);
}
.action-pill.is-error .status-dot {
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

.map-pane :deep(.maplibregl-canvas) {
  outline: none;
}

.map-pane :deep(.maplibregl-ctrl-group) {
  overflow: hidden;
  border: 1px solid rgba(53, 243, 255, 0.24);
  border-radius: 0.4rem;
  background: rgba(7, 7, 19, 0.72);
  box-shadow: 0 0 18px rgba(53, 243, 255, 0.12);
}

.map-pane :deep(.maplibregl-ctrl button) {
  background-color: transparent;
}

.map-pane :deep(.maplibregl-ctrl button:hover) {
  background-color: rgba(53, 243, 255, 0.16);
}

.map-pane :deep(.maplibregl-ctrl-icon) {
  filter: invert(1) drop-shadow(0 0 4px rgba(53, 243, 255, 0.45));
}

.map-pane :deep(.map-marker) {
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 50%;
  border: 2px solid rgb(255, 255, 255);
  background: rgb(53, 243, 255);
  box-shadow: 0 0 0 0 rgba(53, 243, 255, 0.55), 0 0 18px rgba(53, 243, 255, 0.9);
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

.upload-result {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1rem;
  border-radius: 0.6rem;
  border-color: rgba(132, 247, 153, 0.28);
  background:
    linear-gradient(135deg, rgba(132, 247, 153, 0.08), rgba(53, 243, 255, 0.04)),
    rgba(7, 7, 19, 0.72);
}

.upload-result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.upload-result-head h2 {
  margin-top: 0.25rem;
  font-size: 1rem;
  font-weight: 800;
  color: rgb(255, 255, 255);
}

.result-action {
  display: inline-flex;
  min-height: 2.4rem;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0.85rem;
  border-radius: 0.45rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: rgb(226, 232, 240);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
}

.result-action:hover {
  border-color: rgba(53, 243, 255, 0.55);
  background: rgba(53, 243, 255, 0.08);
  color: rgb(255, 255, 255);
}

.result-entry-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.result-entry {
  display: grid;
  grid-template-columns: 4rem minmax(0, 1fr);
  gap: 0.85rem;
  padding: 0.65rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(7, 7, 19, 0.45);
}

.result-entry-cover img {
  width: 4rem;
  height: 4rem;
  border-radius: 0.4rem;
  object-fit: cover;
}

.result-entry-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.result-entry-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: rgb(226, 232, 240);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-entry-tag {
  display: inline-block;
  margin-left: 0.4rem;
  padding: 0.05rem 0.4rem;
  border: 1px solid rgba(251, 191, 36, 0.45);
  border-radius: 999px;
  background: rgba(251, 191, 36, 0.12);
  color: rgb(251, 191, 36);
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  vertical-align: middle;
}

.result-links {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.result-link-row {
  display: grid;
  grid-template-columns: 4.5rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem;
  border-radius: 0.4rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(7, 7, 19, 0.45);
  font-size: 0.7rem;
}

.result-link-row span {
  font-weight: 700;
  color: rgb(53, 243, 255);
}

.result-link-row code {
  min-width: 0;
  overflow: hidden;
  color: rgb(203, 213, 225);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-link-row button {
  min-height: 1.8rem;
  padding: 0.25rem 0.55rem;
  border-radius: 0.35rem;
  border: 1px solid rgba(53, 243, 255, 0.22);
  background: transparent;
  color: rgb(148, 163, 184);
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease;
}

.result-link-row button:hover {
  border-color: rgba(53, 243, 255, 0.55);
  color: rgb(53, 243, 255);
}

@media (max-width: 640px) {
  .result-link-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .result-link-row code {
    grid-column: 1 / 3;
    grid-row: 2 / 3;
  }
}
</style>
