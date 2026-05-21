<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import imageCompression from 'browser-image-compression';
import exifr from 'exifr';
import type { Map as MapLibreMap, MapMouseEvent, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import AppShell from '@/shared/ui/AppShell.vue';
import type { ImageRecord } from '@/features/images/image.types';
import { buildHtml, buildMarkdown, buildPublicPageUrl } from '@/features/images/image-links';
import { formatExifTakenAt, normalizeExif } from './exif';
import { MAP_STYLE_URL, RASTER_FALLBACK_STYLE } from './map-style';
import { previewAiAnnotation } from './ai-preview.api';
import { uploadImage } from './upload.api';
import { buildUploadFormData } from './upload-form';
import type { UploadDimensions, UploadExif, UploadMeta } from './upload.types';

const MAX_ORIGINAL_BYTES = 50 * 1024 * 1024;
const MAX_EDGE = 2048;
const DEFAULT_CENTER = { lat: 31.2304, lng: 121.4737 };

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

type MapLoadState = 'loading' | 'ready' | 'fallback';

const fileInputRef = ref<HTMLInputElement | null>(null);
const mapRef = ref<HTMLDivElement | null>(null);

const selectedFile = ref<File | null>(null);
const compressedFile = ref<File | null>(null);
const compressedDimensions = ref<UploadDimensions | null>(null);
const previewUrl = ref<string | null>(null);
const exif = ref<UploadExif>(emptyExif());
const processing = ref(false);
const aiProcessing = ref(false);
const aiError = ref<string | null>(null);
const uploading = ref(false);
const errorMessage = ref<string | null>(null);
const uploadFinished = ref(false);
const uploadResult = ref<ImageRecord | null>(null);
const copiedLinkLabel = ref<string | null>(null);
const mapLoadState = ref<MapLoadState>('loading');

const meta = reactive<UploadMeta>({
  title: '',
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

let map: MapLibreMap | null = null;
let marker: Marker | null = null;
let previewObjectUrl: string | null = null;
let maplibre: typeof import('maplibre-gl') | null = null;
let usingFallbackStyle = false;
let copiedTimer: ReturnType<typeof setTimeout> | null = null;
let aiPreviewRequestId = 0;

const hasFile = computed(() => selectedFile.value !== null);
const canBuildFormData = computed(
  () =>
    selectedFile.value !== null &&
    compressedFile.value !== null &&
    compressedDimensions.value !== null &&
    !processing.value &&
    !uploading.value &&
    uploadResult.value === null,
);
const queueCountLabel = computed(() => (hasFile.value ? '1 张' : '空'));
const origin = typeof window !== 'undefined' ? window.location.origin : '';

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

const originalSize = computed(() => formatBytes(selectedFile.value?.size ?? 0));
const compressedSize = computed(() => formatBytes(compressedFile.value?.size ?? 0));
const compressRatio = computed(() => {
  const o = selectedFile.value?.size ?? 0;
  const c = compressedFile.value?.size ?? 0;
  if (o <= 0 || c <= 0) return null;
  return Math.max(0, Math.round((1 - c / o) * 100));
});

const statusLabel = computed(() => {
  if (errorMessage.value) return '处理失败';
  if (uploading.value) return '正在上传';
  if (processing.value) return '正在解析 EXIF 与压缩';
  if (aiProcessing.value) return 'AI 分析中';
  if (uploadFinished.value) return '上传完成，可复制链接';
  if (canBuildFormData.value) return '准备就绪';
  if (hasFile.value) return '等待压缩';
  return '等待选择图片';
});

const absoluteUrl = (url: string): string => {
  if (!origin) return url;
  return new URL(url, origin).toString();
};

const uploadResultLinks = computed(() => {
  if (!uploadResult.value) return [];
  const imageUrl = absoluteUrl(uploadResult.value.public_url);
  const imageForCopy = { ...uploadResult.value, public_url: imageUrl };
  return [
    { label: '图片直链', value: imageUrl },
    { label: 'Markdown', value: buildMarkdown(imageForCopy) },
    { label: 'HTML', value: buildHtml(imageForCopy) },
    { label: '公开页', value: buildPublicPageUrl(uploadResult.value, origin) },
  ];
});

const display = (value: string | number | null): string => {
  if (value === null || value === '') return '--';
  return String(value);
};

const formatFocalLength = (value: number | null): string => {
  if (value === null) return '--';
  return `${Number(value.toFixed(2))} mm`;
};

const setPreviewUrl = (file: File | null) => {
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = file ? URL.createObjectURL(file) : null;
  previewUrl.value = previewObjectUrl;
};

const setCoordinates = (lat: number | null, lng: number | null, centerMap = true) => {
  meta.location_lat = lat;
  meta.location_lng = lng;
  updateMapMarker(centerMap);
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
  const lat = meta.location_lat;
  const lng = meta.location_lng;

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
    attributionControl: { compact: true },
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
    setCoordinates(
      Number(event.lngLat.lat.toFixed(6)),
      Number(event.lngLat.lng.toFixed(6)),
      false,
    );
  });
  updateMapMarker(false);
};

const resetStateForFile = (file: File) => {
  selectedFile.value = file;
  compressedFile.value = null;
  compressedDimensions.value = null;
  exif.value = emptyExif();
  errorMessage.value = null;
  uploadFinished.value = false;
  uploadResult.value = null;
  copiedLinkLabel.value = null;
  aiError.value = null;
  aiPreviewRequestId += 1;
  meta.title = file.name.replace(/\.[^.]+$/, '');
  meta.caption = '';
  meta.location_name = '';
  meta.tags = '';
  meta.search_content = '';
  meta.dominant_color = '';
  meta.palette = '';
  meta.composition = '';
  meta.ai_status = 'pending';
  setCoordinates(null, null, false);
  setPreviewUrl(file);
};

const clearSelection = () => {
  selectedFile.value = null;
  compressedFile.value = null;
  compressedDimensions.value = null;
  exif.value = emptyExif();
  errorMessage.value = null;
  uploadFinished.value = false;
  uploadResult.value = null;
  copiedLinkLabel.value = null;
  processing.value = false;
  aiProcessing.value = false;
  aiError.value = null;
  aiPreviewRequestId += 1;
  uploading.value = false;
  meta.title = '';
  meta.caption = '';
  meta.location_name = '';
  meta.tags = '';
  meta.search_content = '';
  meta.dominant_color = '';
  meta.palette = '';
  meta.composition = '';
  meta.ai_status = 'pending';
  setCoordinates(null, null, false);
  setPreviewUrl(null);
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
    useWebWorker: false,
    fileType: 'image/webp',
    initialQuality: 0.86,
    preserveExif: false,
  });

  const outputName = file.name.replace(/\.[^.]+$/, '.webp');
  return new File([compressed], outputName, { type: 'image/webp', lastModified: Date.now() });
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

const applyExifLocation = () => {
  if (exif.value.location_lat === null || exif.value.location_lng === null) return;
  setCoordinates(exif.value.location_lat, exif.value.location_lng);
};

const runAiPreview = async (file = compressedFile.value) => {
  if (!file) return;
  const requestId = ++aiPreviewRequestId;
  aiProcessing.value = true;
  aiError.value = null;
  meta.ai_status = 'pending';

  try {
    const result = await previewAiAnnotation(file);
    if (requestId !== aiPreviewRequestId || compressedFile.value !== file) return;

    meta.title = result.title || meta.title;
    meta.caption = result.caption;
    meta.tags = result.tags.join(', ');
    meta.search_content = result.search_content;
    meta.dominant_color = result.dominant_color;
    meta.palette = result.palette.join(', ');
    meta.composition = result.composition;
    meta.ai_status = 'done';
  } catch (error) {
    if (requestId !== aiPreviewRequestId) return;
    aiError.value = (error as Error).message || 'AI 分析失败。';
    meta.ai_status = 'failed';
  } finally {
    if (requestId === aiPreviewRequestId) aiProcessing.value = false;
  }
};

const selectFile = async (file: File | null) => {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    errorMessage.value = '请选择图片文件。';
    return;
  }
  if (file.size > MAX_ORIGINAL_BYTES) {
    errorMessage.value = '单张图片超过 50 MB，当前阶段不支持。';
    return;
  }

  resetStateForFile(file);
  processing.value = true;
  try {
    const [nextExif, nextCompressed] = await Promise.all([readExif(file), compressToWebp(file)]);
    const nextDimensions = await readImageDimensions(nextCompressed);
    exif.value = nextExif;
    compressedFile.value = nextCompressed;
    compressedDimensions.value = nextDimensions;
    applyExifLocation();
    void runAiPreview(nextCompressed);
  } catch (error) {
    errorMessage.value = (error as Error).message || '图片处理失败。';
  } finally {
    processing.value = false;
    await nextTick();
    map?.resize();
  }
};

const handleInputChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  void selectFile(input.files?.[0] ?? null);
  input.value = '';
};

const handleDrop = (event: DragEvent) => {
  void selectFile(event.dataTransfer?.files[0] ?? null);
};

const openFilePicker = () => {
  fileInputRef.value?.click();
};

const updateLat = (event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  const lat = Number(value);
  setCoordinates(
    value === '' || !Number.isFinite(lat) ? null : lat,
    meta.location_lng,
    false,
  );
};

const updateLng = (event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  const lng = Number(value);
  setCoordinates(
    meta.location_lat,
    value === '' || !Number.isFinite(lng) ? null : lng,
    false,
  );
};

const clearLocation = () => {
  meta.location_name = '';
  setCoordinates(null, null, false);
};

const copyResultLink = async (label: string, value: string) => {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    return;
  }
  copiedLinkLabel.value = label;
  if (copiedTimer) clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    copiedLinkLabel.value = null;
  }, 1400);
};

const startNextUpload = async () => {
  clearSelection();
  await nextTick();
  openFilePicker();
};

const submitUpload = async () => {
  const dimensions = compressedDimensions.value;
  if (!selectedFile.value || !compressedFile.value || !dimensions) return;

  const formData = buildUploadFormData({
    original: selectedFile.value,
    compressed: compressedFile.value,
    exif: exif.value,
    meta: { ...meta },
    dimensions,
  });

  uploading.value = true;
  errorMessage.value = null;
  uploadFinished.value = false;
  try {
    const record = await uploadImage(formData);
    uploadFinished.value = true;
    uploadResult.value = record;
  } catch (error) {
    errorMessage.value = (error as Error).message || '上传失败。';
  } finally {
    uploading.value = false;
  }
};

onMounted(() => {
  void initMap();
});

onBeforeUnmount(() => {
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  if (copiedTimer) clearTimeout(copiedTimer);
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
          class="sr-only"
          @change="handleInputChange"
        />

        <button
          type="button"
          class="drop-zone"
          :class="{ 'is-compact': hasFile }"
          @click="openFilePicker"
          @dragover.prevent
          @drop.prevent="handleDrop"
        >
          <span class="drop-icon" aria-hidden="true">
            <svg viewBox="0 0 512 512" fill="currentColor"><path d="M288 109.3V352c0 17.7-14.3 32-32 32s-32-14.3-32-32V109.3l-73.4 73.4c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l128-128c12.5-12.5 32.8-12.5 45.3 0l128 128c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L288 109.3zM64 352H192c0 35.3 28.7 64 64 64s64-28.7 64-64H448c35.3 0 64 28.7 64 64v32c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V416c0-35.3 28.7-64 64-64z" /></svg>
          </span>
          <div class="drop-text">
            <p class="drop-title">{{ hasFile ? '点击或拖拽切换其他图片' : '拖拽图片到此或点击选择' }}</p>
            <p class="drop-hint">单张上限 50 MB，自动压缩为 WebP</p>
          </div>
        </button>

        <div
          v-if="errorMessage"
          class="error-banner"
          role="alert"
        >
          <span aria-hidden="true" class="error-icon">!</span>
          <span>{{ errorMessage }}</span>
        </div>

        <div class="workbench">
          <aside class="queue-rail cyber-panel">
            <header class="queue-header">
              <p class="section-eyebrow">Queue</p>
              <span class="section-count">{{ queueCountLabel }}</span>
            </header>
            <div class="queue-list">
              <div v-if="hasFile" class="thumb-cell">
                <button
                  type="button"
                  class="thumb is-active"
                  :aria-label="`重新选择，当前：${selectedFile?.name ?? ''}`"
                  @click="openFilePicker"
                >
                  <img
                    v-if="previewUrl"
                    :src="previewUrl"
                    alt="当前选中图片缩略图"
                    class="h-full w-full object-cover"
                  />
                </button>
                <button
                  type="button"
                  class="thumb-remove"
                  aria-label="从队列中移除"
                  @click.stop="clearSelection"
                >
                  <svg viewBox="0 0 384 512" fill="currentColor" aria-hidden="true">
                    <path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z" />
                  </svg>
                </button>
              </div>
              <button v-else type="button" class="thumb-empty" @click="openFilePicker" aria-label="选择图片">
                <svg viewBox="0 0 448 512" fill="currentColor" aria-hidden="true">
                  <path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z" />
                </svg>
              </button>
            </div>
          </aside>

          <figure class="preview-stage cyber-panel">
            <template v-if="previewUrl">
              <img
                :src="previewUrl"
                :alt="selectedFile?.name ?? '图片预览'"
                class="preview-image"
              />
              <figcaption class="preview-caption">
                <span class="preview-name">{{ selectedFile?.name }}</span>
                <span v-if="processing" class="preview-busy">处理中</span>
                <span v-else-if="compressedFile" class="preview-ok">已压缩</span>
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
                  <dd class="truncate font-mono">{{ selectedFile?.name ?? '--' }}</dd>
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
                  <dd class="font-mono">{{ formatExifTakenAt(exif.taken_at) }}</dd>
                </div>
                <div class="meta-row exif-row-wide">
                  <dt>相机</dt>
                  <dd class="font-mono truncate">{{ display(exif.camera) }}</dd>
                </div>
                <div class="meta-row">
                  <dt>ISO</dt>
                  <dd class="font-mono">{{ display(exif.iso) }}</dd>
                </div>
                <div class="meta-row">
                  <dt>快门</dt>
                  <dd class="font-mono">{{ display(exif.shutter) }}</dd>
                </div>
                <div class="meta-row">
                  <dt>光圈</dt>
                  <dd class="font-mono">{{ exif.aperture === null ? '--' : `f/${exif.aperture}` }}</dd>
                </div>
                <div class="meta-row">
                  <dt>焦距</dt>
                  <dd class="font-mono">{{ formatFocalLength(exif.focal_length) }}</dd>
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
                  :disabled="!compressedFile || aiProcessing"
                  @click="runAiPreview()"
                >
                  {{ aiProcessing ? 'AI 分析中' : '重新 AI 分析' }}
                </button>
              </header>
              <p v-if="aiError" class="ai-error">{{ aiError }}</p>
              <label class="field">
                <span class="field-label">标题</span>
                <input v-model="meta.title" type="text" class="cyber-input" :disabled="!hasFile" />
              </label>
              <label class="field">
                <span class="field-label">描述</span>
                <textarea v-model="meta.caption" rows="3" class="cyber-input" :disabled="!hasFile"></textarea>
              </label>
              <label class="field">
                <span class="field-label">标签</span>
                <input
                  v-model="meta.tags"
                  type="text"
                  class="cyber-input"
                  placeholder="用逗号分隔，例如：猫, 夜景"
                  :disabled="!hasFile"
                />
              </label>
              <label class="field">
                <span class="field-label">主色调</span>
                <input
                  v-model="meta.dominant_color"
                  type="text"
                  class="cyber-input"
                  placeholder="例如：暮光橙 #F59E0B"
                  :disabled="!hasFile"
                />
              </label>
              <label class="field">
                <span class="field-label">色板</span>
                <input
                  v-model="meta.palette"
                  type="text"
                  class="cyber-input"
                  placeholder="用逗号分隔，例如：#F59E0B, #0F172A"
                  :disabled="!hasFile"
                />
              </label>
              <label class="field">
                <span class="field-label">构图</span>
                <textarea v-model="meta.composition" rows="2" class="cyber-input" :disabled="!hasFile"></textarea>
              </label>
              <label class="field">
                <span class="field-label">搜索文本</span>
                <textarea v-model="meta.search_content" rows="2" class="cyber-input" :disabled="!hasFile"></textarea>
              </label>
              <label class="field">
                <span class="field-label">位置名称</span>
                <input
                  v-model="meta.location_name"
                  type="text"
                  class="cyber-input"
                  placeholder="例如：上海 外滩"
                  :disabled="!hasFile"
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
                      :value="meta.location_lat ?? ''"
                      @input="updateLat"
                    />
                  </label>
                  <label class="field">
                    <span class="field-sublabel">经度</span>
                    <input
                      type="number"
                      step="0.000001"
                      class="cyber-input"
                      :value="meta.location_lng ?? ''"
                      @input="updateLng"
                    />
                  </label>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <section v-if="uploadResult" class="upload-result cyber-panel" aria-live="polite">
          <div class="upload-result-main">
            <p class="section-eyebrow">Uploaded</p>
            <h2>上传完成</h2>
            <p>{{ uploadResult.title || selectedFile?.name }} 已写入图床，可以继续上传或复制链接。</p>
          </div>
          <div class="upload-result-actions">
            <RouterLink
              class="result-action result-action-primary"
              :to="{ name: 'public-image', params: { key: uploadResult.key } }"
            >
              查看公开页
            </RouterLink>
            <button type="button" class="result-action" @click="startNextUpload">
              继续上传
            </button>
          </div>
          <ul class="result-links">
            <li v-for="row in uploadResultLinks" :key="row.label" class="result-link-row">
              <span>{{ row.label }}</span>
              <code>{{ row.value }}</code>
              <button type="button" @click="copyResultLink(row.label, row.value)">
                {{ copiedLinkLabel === row.label ? '已复制' : '复制' }}
              </button>
            </li>
          </ul>
        </section>

        <footer class="page-footer">
          <span class="footer-status">{{ statusLabel }}</span>
          <button type="button" class="cyber-button" :disabled="!canBuildFormData" @click="submitUpload">
            {{ uploading ? '上传中' : '上传图片' }}
          </button>
        </footer>
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
  padding-bottom: 2rem;
}

.drop-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  width: 100%;
  padding: 1.75rem 1.5rem;
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
  font-size: 0.95rem;
  font-weight: 700;
  color: rgb(255, 255, 255);
}
.drop-hint {
  margin-top: 0.2rem;
  font-size: 0.75rem;
  color: rgb(148, 163, 184);
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
    grid-template-columns: 8rem minmax(0, 1fr) 24rem;
    align-items: stretch;
  }
}

.queue-rail {
  border-radius: 0.6rem;
  padding: 0.85rem;
  min-width: 0;
}

.queue-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0 0.1rem 0.65rem;
  margin-bottom: 0.6rem;
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
}

@media (min-width: 1024px) {
  .queue-list {
    flex-direction: column;
    align-items: center;
    overflow-x: visible;
    overflow-y: visible;
    padding-right: 0;
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
    min-height: 34rem;
  }
}

.meta-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.1rem;
  border-radius: 0.6rem;
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
  gap: 0.7rem;
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
  gap: 0.75rem;
}

.form-title {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.ai-preview-button {
  flex-shrink: 0;
  min-height: 1.8rem;
  padding: 0.25rem 0.55rem;
  border-radius: 0.4rem;
  border: 1px solid rgba(255, 79, 216, 0.26);
  background: rgba(255, 79, 216, 0.08);
  color: rgb(244, 194, 255);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
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
  padding: 0.45rem 0.55rem;
  border-radius: 0.4rem;
  border: 1px solid rgba(248, 113, 113, 0.26);
  background: rgba(248, 113, 113, 0.08);
  color: rgb(254, 205, 211);
  font-size: 11.5px;
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
  gap: 0.45rem;
}

.map-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.map-clear {
  font-size: 11px;
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
  height: 11rem;
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

.map-pane :deep(.maplibregl-ctrl-attrib) {
  background: rgba(7, 7, 19, 0.72);
  color: rgb(148, 163, 184);
}

.map-pane :deep(.maplibregl-ctrl-attrib a) {
  color: rgb(53, 243, 255);
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
  gap: 0.5rem;
}

.upload-result {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  padding: 1rem;
  border-radius: 0.6rem;
  border-color: rgba(132, 247, 153, 0.28);
  background:
    linear-gradient(135deg, rgba(132, 247, 153, 0.08), rgba(53, 243, 255, 0.04)),
    rgba(7, 7, 19, 0.72);
}

@media (min-width: 900px) {
  .upload-result {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
  }
}

.upload-result-main h2 {
  margin-top: 0.25rem;
  font-size: 1rem;
  font-weight: 800;
  color: rgb(255, 255, 255);
}

.upload-result-main p:last-child {
  margin-top: 0.3rem;
  font-size: 0.82rem;
  color: rgb(148, 163, 184);
}

.upload-result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.result-action {
  display: inline-flex;
  min-height: 2.5rem;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 0.85rem;
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

.result-action-primary {
  border-color: rgba(132, 247, 153, 0.45);
  background: rgba(132, 247, 153, 0.12);
  color: rgb(220, 252, 231);
}

.result-links {
  display: flex;
  grid-column: 1 / -1;
  flex-direction: column;
  gap: 0.45rem;
}

.result-link-row {
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0.55rem;
  border-radius: 0.45rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(7, 7, 19, 0.5);
}

.result-link-row span {
  font-size: 0.72rem;
  font-weight: 700;
  color: rgb(53, 243, 255);
}

.result-link-row code {
  min-width: 0;
  overflow: hidden;
  color: rgb(203, 213, 225);
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-link-row button {
  min-height: 2rem;
  padding: 0.3rem 0.6rem;
  border-radius: 0.4rem;
  border: 1px solid rgba(53, 243, 255, 0.22);
  background: transparent;
  color: rgb(148, 163, 184);
  font-size: 0.72rem;
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

.page-footer {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  align-items: flex-start;
  justify-content: space-between;
  padding: 0.5rem 0.25rem 0;
}

@media (min-width: 640px) {
  .page-footer {
    flex-direction: row;
    align-items: center;
  }
}

.footer-status {
  font-size: 0.85rem;
  color: rgb(148, 163, 184);
}
</style>
