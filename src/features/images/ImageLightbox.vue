<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import type { ImageRecord } from './image.types';
import { buildAbsoluteImageUrl, buildHtml, buildMarkdown, buildPublicPageUrl } from './image-links';
import LocationSearch from './LocationSearch.vue';
import ReadOnlyMap from './ReadOnlyMap.vue';
import type { GeocodeResult } from './geocode.api';
import { deleteImage, updateImage } from './images.api';

const props = defineProps<{ open: boolean; image?: ImageRecord | null }>();
const emit = defineEmits<{ close: []; prev: []; next: []; updated: [image: ImageRecord]; deleted: [key: string] }>();

type IconName =
  | 'chevronLeft'
  | 'chevronRight'
  | 'download'
  | 'info'
  | 'expand'
  | 'share'
  | 'check'
  | 'fileAlt'
  | 'robot'
  | 'link'
  | 'clock'
  | 'mapPin'
  | 'trash';

const ICONS: Record<IconName, { vb: string; d: string }> = {
  chevronLeft: { vb: '0 0 320 512', d: 'M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 246.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z' },
  chevronRight: { vb: '0 0 320 512', d: 'M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z' },
  download: { vb: '0 0 512 512', d: 'M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32V274.7l-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7V32zM64 352c-35.3 0-64 28.7-64 64v32c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V416c0-35.3-28.7-64-64-64H346.5l-45.3 45.3c-25 25-65.5 25-90.5 0L165.5 352H64zm368 56a24 24 0 1 1 0 48 24 24 0 1 1 0-48z' },
  info: { vb: '0 0 512 512', d: 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z' },
  expand: { vb: '0 0 512 512', d: 'M344 0H488c13.3 0 24 10.7 24 24V168c0 9.7-5.8 18.5-14.8 22.2s-19.3 1.7-26.2-5.2l-39-39-87 87c-9.4 9.4-24.6 9.4-33.9 0l-32-32c-9.4-9.4-9.4-24.6 0-33.9l87-87L327 41c-6.9-6.9-8.9-17.2-5.2-26.2S334.3 0 344 0zM168 512H24c-13.3 0-24-10.7-24-24V344c0-9.7 5.8-18.5 14.8-22.2s19.3-1.7 26.2 5.2l39 39 87-87c9.4-9.4 24.6-9.4 33.9 0l32 32c9.4 9.4 9.4 24.6 0 33.9l-87 87 39 39c6.9 6.9 8.9 17.2 5.2 26.2s-12.5 14.8-22.2 14.8z' },
  share: { vb: '0 0 448 512', d: 'M352 224c53 0 96-43 96-96s-43-96-96-96s-96 43-96 96c0 4 .2 8 .7 11.9l-94.1 47C145.4 170.2 121.9 160 96 160c-53 0-96 43-96 96s43 96 96 96c25.9 0 49.4-10.2 66.6-26.9l94.1 47c-.5 3.9-.7 7.8-.7 11.9c0 53 43 96 96 96s96-43 96-96s-43-96-96-96c-25.9 0-49.4 10.2-66.6 26.9l-94.1-47c.5-3.9 .7-7.8 .7-11.9s-.2-8-.7-11.9l94.1-47C302.6 213.8 326.1 224 352 224z' },
  check: { vb: '0 0 448 512', d: 'M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z' },
  fileAlt: { vb: '0 0 384 512', d: 'M0 64C0 28.7 28.7 0 64 0H224V128c0 17.7 14.3 32 32 32H384V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V64zm384 64H256V0L384 128z' },
  robot: { vb: '0 0 640 512', d: 'M320 0c17.7 0 32 14.3 32 32V64H472c39.8 0 72 32.2 72 72V392c0 39.8-32.2 72-72 72H168c-39.8 0-72-32.2-72-72V136c0-39.8 32.2-72 72-72H288V32c0-17.7 14.3-32 32-32zM208 384c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H208zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H304zm96 0c-8.8 0-16 7.2-16 16s7.2 16 16 16h32c8.8 0 16-7.2 16-16s-7.2-16-16-16H400zM264 256a40 40 0 1 0 -80 0 40 40 0 1 0 80 0zm152 40a40 40 0 1 0 0-80 40 40 0 1 0 0 80zM48 224H64V416H48c-26.5 0-48-21.5-48-48V272c0-26.5 21.5-48 48-48zm544 0c26.5 0 48 21.5 48 48v96c0 26.5-21.5 48-48 48H576V224h16z' },
  link: { vb: '0 0 640 512', d: 'M579.8 267.7c56.5-56.5 56.5-148 0-204.5c-50-50-128.8-56.5-186.3-15.4l-1.6 1.1c-14.4 10.3-17.7 30.3-7.4 44.6s30.3 17.7 44.6 7.4l1.6-1.1c32.1-22.9 76-19.3 103.8 8.6c31.5 31.5 31.5 82.5 0 114L422.3 334.8c-31.5 31.5-82.5 31.5-114 0c-27.9-27.9-31.5-71.8-8.6-103.8l1.1-1.6c10.3-14.4 6.9-34.4-7.4-44.6s-34.4-6.9-44.6 7.4l-1.1 1.6C206.5 251.2 213 330 263 380c56.5 56.5 148 56.5 204.5 0L579.8 267.7zM60.2 244.3c-56.5 56.5-56.5 148 0 204.5c50 50 128.8 56.5 186.3 15.4l1.6-1.1c14.4-10.3 17.7-30.3 7.4-44.6s-30.3-17.7-44.6-7.4l-1.6 1.1c-32.1 22.9-76 19.3-103.8-8.6C74 372 74 321 105.5 289.5L217.7 177.2c31.5-31.5 82.5-31.5 114 0c27.9 27.9 31.5 71.8 8.6 103.9l-1.1 1.6c-10.3 14.4-6.9 34.4 7.4 44.6s34.4 6.9 44.6-7.4l1.1-1.6C433.5 260.8 427 182 377 132c-56.5-56.5-148-56.5-204.5 0L60.2 244.3z' },
  clock: { vb: '0 0 512 512', d: 'M256 0a256 256 0 1 1 0 512A256 256 0 1 1 256 0zM232 120V256c0 8 4 15.5 10.7 20l96 64c11 7.4 25.9 4.4 33.3-6.7s4.4-25.9-6.7-33.3L280 243.2V120c0-13.3-10.7-24-24-24s-24 10.7-24 24z' },
  mapPin: { vb: '0 0 384 512', d: 'M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0zM192 128a64 64 0 1 1 0 128 64 64 0 1 1 0-128z' },
  trash: { vb: '0 0 24 24', d: 'M9 3h6l1 2h4v2H4V5h4l1-2zm-2 6h10l-1 12H8L7 9zm3 2v8h2v-8h-2zm4 0v8h2v-8h-2z' },
};

const copied = ref(false);
const copiedText = ref('');
let copyTimer: ReturnType<typeof setTimeout> | null = null;
const origin = typeof window !== 'undefined' ? window.location.origin : '';

const detailsOpen = ref(false);
const aiEditOpen = ref(false);
const locationEditOpen = ref(false);
const saving = ref(false);
const deleting = ref(false);
const actionError = ref<string | null>(null);

const editForm = reactive({
  title: '',
  caption: '',
  tags: '',
  dominant_color: '',
  palette: '',
  composition: '',
  location_name: '',
  location_lat: '' as number | '',
  location_lng: '' as number | '',
});

const publicPageUrl = computed(() => {
  if (!props.image) return '';
  return buildPublicPageUrl(props.image, origin);
});

const originalImageUrl = (image: ImageRecord) => `/api/original/${encodeURIComponent(image.key)}`;

const originalUrl = computed(() => {
  if (!props.image) return '';
  return originalImageUrl(props.image);
});

const linkRows = computed(() => {
  if (!props.image) return [];
  const imageUrl = buildAbsoluteImageUrl(props.image.public_url, origin);
  const imageForCopy = { ...props.image, public_url: imageUrl };
  return [
    { label: '图片直链', value: imageUrl },
    { label: 'Markdown', value: buildMarkdown(imageForCopy) },
    { label: 'HTML', value: buildHtml(imageForCopy) },
    { label: '公开页', value: publicPageUrl.value },
  ];
});

const formatBytes = (bytes: number): string => {
  if (bytes <= 0) return '未记录';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
};

const formatExifTakenAt = (value: string | null): string => {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
};

const exifRows = computed(() => {
  const image = props.image;
  if (!image) return [];
  return [
    { label: '拍摄时间', value: formatExifTakenAt(image.exif_taken_at), muted: !image.exif_taken_at, span: 'full' },
    { label: '相机', value: image.exif_camera || '未记录', muted: !image.exif_camera, span: 'full' },
    { label: 'ISO', value: image.exif_iso === null ? '未记录' : `ISO ${image.exif_iso}`, muted: image.exif_iso === null, span: 'half' },
    {
      label: '光圈',
      value: image.exif_aperture === null ? '未记录' : `f/${image.exif_aperture}`,
      muted: image.exif_aperture === null,
      span: 'half',
    },
    { label: '快门', value: image.exif_shutter || '未记录', muted: !image.exif_shutter, span: 'half' },
    {
      label: '焦距',
      value: image.exif_focal_length === null ? '未记录' : `${image.exif_focal_length} mm`,
      muted: image.exif_focal_length === null,
      span: 'half',
    },
  ];
});

const tagsFromImage = (image: ImageRecord | null | undefined): string[] => {
  if (!image?.tags_json) return [];
  try {
    const parsed = JSON.parse(image.tags_json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((tag): tag is string => typeof tag === 'string')
      .map((tag) => tag.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
};

const tagsTextFromImage = (image: ImageRecord | null | undefined): string => tagsFromImage(image).join(', ');

const aiTags = computed(() => tagsFromImage(props.image));

const paletteFromImage = (image: ImageRecord | null | undefined): string[] => {
  if (!image?.color_palette_json) return [];
  try {
    const parsed = JSON.parse(image.color_palette_json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((color): color is string => typeof color === 'string')
      .map((color) => color.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
};

const paletteTextFromImage = (image: ImageRecord | null | undefined): string =>
  paletteFromImage(image).join(', ');

const parseDominantColor = (value: string | null | undefined): { name: string; hex: string } => {
  const raw = value?.trim() ?? '';
  const hex = raw.match(/#[0-9a-fA-F]{6}\b/)?.[0].toUpperCase() ?? '';
  const name = hex ? raw.replace(new RegExp(hex, 'i'), '').trim() : raw;
  return {
    name: name || raw || '未记录',
    hex,
  };
};

const aiPalette = computed(() => paletteFromImage(props.image));
const dominantColor = computed(() => parseDominantColor(props.image?.dominant_color));

const hasCoordinates = computed(
  () => props.image?.location_lat != null && props.image?.location_lng != null,
);

const toMapCoordinate = (value: number | string | null | undefined): number | null => {
  if (value === '' || value == null) return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
};

const mapLat = computed(() => toMapCoordinate(
  locationEditOpen.value ? editForm.location_lat : props.image?.location_lat,
));

const mapLng = computed(() => toMapCoordinate(
  locationEditOpen.value ? editForm.location_lng : props.image?.location_lng,
));

const copyValue = async (value: string, label = '链接') => {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    return;
  }
  copiedText.value = label;
  copied.value = true;
  if (copyTimer) clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    copied.value = false;
    copiedText.value = '';
  }, 1400);
};

const sharePage = async () => {
  if (!props.image) return;
  await copyValue(publicPageUrl.value, '分享链接');
};

const resetForm = (image: ImageRecord | null | undefined) => {
  actionError.value = null;
  editForm.title = image?.title ?? '';
  editForm.caption = image?.caption ?? '';
  editForm.tags = tagsTextFromImage(image);
  editForm.dominant_color = image?.dominant_color ?? '';
  editForm.palette = paletteTextFromImage(image);
  editForm.composition = image?.composition ?? '';
  editForm.location_name = image?.location_name ?? '';
  editForm.location_lat = image?.location_lat ?? '';
  editForm.location_lng = image?.location_lng ?? '';
};

const openAiEditor = () => {
  resetForm(props.image);
  aiEditOpen.value = true;
};

const cancelAiEditor = () => {
  resetForm(props.image);
  actionError.value = null;
  aiEditOpen.value = false;
};

const saveAiMetadata = async () => {
  if (!props.image) return;
  saving.value = true;
  actionError.value = null;
  try {
    const updated = await updateImage(props.image.key, {
      title: editForm.title,
      caption: editForm.caption,
      location_name: props.image.location_name ?? '',
      location_lat: props.image.location_lat,
      location_lng: props.image.location_lng,
      tags: editForm.tags,
      dominant_color: editForm.dominant_color,
      palette: editForm.palette,
      composition: editForm.composition,
    });
    emit('updated', updated);
    resetForm(updated);
    aiEditOpen.value = false;
  } catch (error) {
    actionError.value = (error as Error).message;
  } finally {
    saving.value = false;
  }
};

const openLocationEditor = () => {
  resetForm(props.image);
  locationEditOpen.value = true;
};

const cancelLocationEditor = () => {
  resetForm(props.image);
  actionError.value = null;
  locationEditOpen.value = false;
};

const updateLocationFromMap = (coords: { lat: number; lng: number }) => {
  editForm.location_lat = coords.lat;
  editForm.location_lng = coords.lng;
};

const applyLocationSearchResult = (result: GeocodeResult) => {
  editForm.location_name = result.name;
  editForm.location_lat = result.lat;
  editForm.location_lng = result.lng;
};

const saveLocation = async () => {
  if (!props.image) return;
  saving.value = true;
  actionError.value = null;
  try {
    const updated = await updateImage(props.image.key, {
      title: props.image.title,
      caption: props.image.caption ?? '',
      location_name: editForm.location_name,
      location_lat: editForm.location_lat === '' ? null : Number(editForm.location_lat),
      location_lng: editForm.location_lng === '' ? null : Number(editForm.location_lng),
      tags: tagsTextFromImage(props.image),
      dominant_color: props.image.dominant_color ?? '',
      palette: paletteTextFromImage(props.image),
      composition: props.image.composition ?? '',
    });
    emit('updated', updated);
    resetForm(updated);
    locationEditOpen.value = false;
  } catch (error) {
    actionError.value = (error as Error).message;
  } finally {
    saving.value = false;
  }
};

const deleteCurrentImage = async () => {
  if (!props.image) return;
  if (!confirm('确认删除这张图片？')) return;
  deleting.value = true;
  actionError.value = null;
  try {
    const key = props.image.key;
    await deleteImage(key);
    emit('deleted', key);
  } catch (error) {
    actionError.value = (error as Error).message;
  } finally {
    deleting.value = false;
  }
};

const toggleDetails = () => {
  detailsOpen.value = !detailsOpen.value;
};

const handleViewerSurfaceClick = () => {
  if (detailsOpen.value) {
    detailsOpen.value = false;
    return;
  }
  emit('close');
};

const handleKey = (e: KeyboardEvent) => {
  if (!props.open) return;
  if (e.key === 'Escape') {
    if (detailsOpen.value) {
      detailsOpen.value = false;
      return;
    }
    emit('close');
  }
  if (e.key === 'ArrowLeft') emit('prev');
  if (e.key === 'ArrowRight') emit('next');
};

watch(
  () => props.open,
  (open) => {
    if (open) {
      window.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    } else {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
      copied.value = false;
      detailsOpen.value = false;
      aiEditOpen.value = false;
      locationEditOpen.value = false;
      if (copyTimer) {
        clearTimeout(copyTimer);
        copyTimer = null;
      }
    }
  },
  { immediate: true },
);

watch(
  () => props.image,
  (image) => resetForm(image),
  { immediate: true },
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKey);
  document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <Transition name="lightbox">
      <div v-if="open" class="image-viewer-wrapper">
        <div class="cyber-image-viewer">
          <div class="viewer-backdrop" @click="handleViewerSurfaceClick" aria-hidden="true" />

          <div class="viewer-container">
            <header class="navigation-bar">
              <button type="button" class="viewer-esc-button" aria-label="关闭（ESC）" @click="emit('close')">ESC</button>

              <div class="nav-actions">
                <button
                  type="button"
                  class="viewer-action-btn"
                  :class="{ 'is-success': copied }"
                  title="复制分享链接"
                  :aria-label="copied ? '分享链接已复制' : '复制分享链接'"
                  :disabled="!image"
                  @click="sharePage"
                >
                  <svg
                    :viewBox="copied ? ICONS.check.vb : ICONS.share.vb"
                    fill="currentColor"
                    class="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path :d="copied ? ICONS.check.d : ICONS.share.d" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="viewer-action-btn"
                  :class="{ 'is-active': detailsOpen }"
                  title="详情"
                  :aria-label="detailsOpen ? '关闭详情面板' : '查看详情'"
                  :disabled="!image"
                  @click="toggleDetails"
                >
                  <svg :viewBox="ICONS.info.vb" fill="currentColor" class="h-4 w-4" aria-hidden="true"><path :d="ICONS.info.d" /></svg>
                </button>
                <a
                  v-if="image"
                  class="viewer-action-btn"
                  :href="originalUrl"
                  target="_blank"
                  rel="noreferrer"
                  title="下载原图"
                  aria-label="下载原图"
                >
                  <svg :viewBox="ICONS.download.vb" fill="currentColor" class="h-4 w-4" aria-hidden="true"><path :d="ICONS.download.d" /></svg>
                </a>
                <button v-else type="button" class="viewer-action-btn" title="下载原图" aria-label="下载原图" disabled>
                  <svg :viewBox="ICONS.download.vb" fill="currentColor" class="h-4 w-4" aria-hidden="true"><path :d="ICONS.download.d" /></svg>
                </button>
                <button type="button" class="viewer-action-btn" title="全屏" aria-label="全屏（阶段 7 接入）" disabled>
                  <svg :viewBox="ICONS.expand.vb" fill="currentColor" class="h-3.5 w-3.5" aria-hidden="true"><path :d="ICONS.expand.d" /></svg>
                </button>
                <button
                  type="button"
                  class="viewer-action-btn danger"
                  title="删除图片"
                  aria-label="删除图片"
                  :disabled="!image || saving || deleting"
                  @click="deleteCurrentImage"
                >
                  <svg :viewBox="ICONS.trash.vb" fill="currentColor" class="h-4 w-4" aria-hidden="true"><path :d="ICONS.trash.d" /></svg>
                </button>
              </div>
            </header>

            <div class="viewer-content">
              <figure class="image-canvas" :class="{ 'has-drawer': detailsOpen }" @click="handleViewerSurfaceClick">
                <img
                  v-if="image"
                  :src="image.public_url"
                  :alt="image.title"
                  class="main-image"
                  @click.stop
                />
                <figcaption class="sr-only">
                  {{ image ? `${image.title} 预览` : '未选中图片，请从图库点击进入' }}
                </figcaption>
              </figure>

              <button type="button" class="nav-arrow nav-arrow-left" aria-label="上一张（←）" @click.stop="emit('prev')">
                <svg :viewBox="ICONS.chevronLeft.vb" fill="currentColor" class="h-5 w-5" aria-hidden="true"><path :d="ICONS.chevronLeft.d" /></svg>
              </button>

              <button type="button" class="nav-arrow nav-arrow-right" aria-label="下一张（→）" @click.stop="emit('next')">
                <svg :viewBox="ICONS.chevronRight.vb" fill="currentColor" class="h-5 w-5" aria-hidden="true"><path :d="ICONS.chevronRight.d" /></svg>
              </button>

            <aside
              class="drawer-panel"
              :class="{ 'is-open': detailsOpen }"
              aria-label="图片详情"
              @click.stop
            >
              <header class="drawer-header">
                <span class="drawer-title">详情</span>
              </header>

              <div v-if="image" class="drawer-content">
                <section class="detail-section">
                  <div class="section-title">
                    <svg :viewBox="ICONS.fileAlt.vb" fill="currentColor" class="section-icon" aria-hidden="true"><path :d="ICONS.fileAlt.d" /></svg>
                    <span>基本信息</span>
                  </div>
                  <div class="detail-items">
                    <div class="detail-item">
                      <span class="item-label">文件名</span>
                      <span class="item-value text-truncate">{{ image.original_filename || image.key }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="item-label">文件大小</span>
                      <span class="item-value">{{ formatBytes(image.bytes_compressed) }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="item-label">分辨率</span>
                      <span class="item-value">
                        <span class="badge">{{ image.width }} × {{ image.height }}</span>
                      </span>
                    </div>
                    <div class="detail-item">
                      <span class="item-label">格式</span>
                      <span class="item-value">
                        <span class="badge">{{ image.format.toUpperCase() }}</span>
                      </span>
                    </div>
                    <div class="detail-item">
                      <span class="item-label">访问级别</span>
                      <span class="item-value">
                        <span class="badge badge-lime">公开</span>
                      </span>
                    </div>
                  </div>
                </section>

                <section class="detail-section">
                  <div class="section-title">
                    <svg :viewBox="ICONS.clock.vb" fill="currentColor" class="section-icon" aria-hidden="true"><path :d="ICONS.clock.d" /></svg>
                    <span>EXIF</span>
                  </div>
                  <div class="exif-grid">
                    <div
                      v-for="row in exifRows"
                      :key="row.label"
                      class="detail-item exif-item"
                      :class="{ 'is-full': row.span === 'full' }"
                    >
                      <span class="item-label">{{ row.label }}</span>
                      <span class="item-value" :class="{ 'text-muted': row.muted }">{{ row.value }}</span>
                    </div>
                  </div>
                </section>

                <section class="detail-section">
                  <div class="section-title section-title-with-action">
                    <span class="section-title-label">
                      <svg :viewBox="ICONS.robot.vb" fill="currentColor" class="section-icon" aria-hidden="true"><path :d="ICONS.robot.d" /></svg>
                      <span>AI 分析</span>
                    </span>
                    <button
                      type="button"
                      class="ai-edit-button"
                      :disabled="saving || deleting"
                      @click="aiEditOpen ? cancelAiEditor() : openAiEditor()"
                    >
                      {{ aiEditOpen ? '收起' : '编辑' }}
                    </button>
                  </div>
                  <div class="detail-items">
                    <div class="detail-item">
                      <span class="item-label">标题</span>
                      <span class="item-value text-truncate">{{ image.title || '未命名图片' }}</span>
                    </div>
                    <div class="detail-item is-column">
                      <span class="item-label">描述</span>
                      <p v-if="image.caption" class="item-description">{{ image.caption }}</p>
                      <p v-else class="item-description text-muted">阶段 11 接入 AI 描述</p>
                    </div>
                    <div class="detail-item is-column">
                      <span class="item-label">标签</span>
                      <div v-if="aiTags.length" class="tag-list">
                        <span v-for="tag in aiTags" :key="tag" class="tag-pill">{{ tag }}</span>
                      </div>
                      <p v-else class="item-description text-muted">暂无标签</p>
                    </div>
                    <div class="detail-item">
                      <span class="item-label">主色调</span>
                      <span
                        v-if="image.dominant_color"
                        class="dominant-color-value"
                        :title="dominantColor.hex || image.dominant_color"
                      >
                        <span
                          v-if="dominantColor.hex"
                          class="palette-chip dominant-color-chip"
                          :style="{ backgroundColor: dominantColor.hex }"
                          aria-hidden="true"
                        />
                        <span class="dominant-color-name">{{ dominantColor.name }}</span>
                      </span>
                      <span v-else class="item-value text-muted">未记录</span>
                    </div>
                    <div class="detail-item is-column">
                      <span class="item-label">色板</span>
                      <div v-if="aiPalette.length" class="palette-list">
                        <span
                          v-for="color in aiPalette"
                          :key="color"
                          class="palette-chip"
                          :style="{ backgroundColor: color }"
                          :title="color"
                        />
                      </div>
                      <p v-else class="item-description text-muted">暂无色板</p>
                    </div>
                    <div class="detail-item is-column">
                      <span class="item-label">构图</span>
                      <p v-if="image.composition" class="item-description">{{ image.composition }}</p>
                      <p v-else class="item-description text-muted">未记录</p>
                    </div>
                  </div>
                  <form v-if="aiEditOpen" class="ai-edit-form" @submit.prevent="saveAiMetadata">
                    <label class="edit-field">
                      <span>标题</span>
                      <input v-model="editForm.title" type="text" />
                    </label>
                    <label class="edit-field">
                      <span>描述</span>
                      <textarea v-model="editForm.caption" rows="3" />
                    </label>
                    <label class="edit-field">
                      <span>标签</span>
                      <textarea v-model="editForm.tags" rows="2" placeholder="用逗号或换行分隔" />
                    </label>
                    <label class="edit-field">
                      <span>主色调</span>
                      <input v-model="editForm.dominant_color" type="text" placeholder="暮光橙 #F59E0B" />
                    </label>
                    <label class="edit-field">
                      <span>色板</span>
                      <textarea v-model="editForm.palette" rows="2" placeholder="用逗号或换行分隔 HEX" />
                    </label>
                    <label class="edit-field">
                      <span>构图</span>
                      <textarea v-model="editForm.composition" rows="2" />
                    </label>
                    <p v-if="actionError" class="action-error">{{ actionError }}</p>
                    <div class="edit-actions">
                      <button type="submit" class="action-btn" :disabled="saving || deleting">
                        {{ saving ? '保存中…' : '保存' }}
                      </button>
                      <button type="button" class="action-btn muted" :disabled="saving || deleting" @click="cancelAiEditor">
                        取消
                      </button>
                    </div>
                  </form>
                </section>

                <section class="detail-section">
                  <div class="section-title section-title-with-action">
                    <span class="section-title-label">
                      <svg :viewBox="ICONS.mapPin.vb" fill="currentColor" class="section-icon" aria-hidden="true"><path :d="ICONS.mapPin.d" /></svg>
                      <span>位置</span>
                    </span>
                    <button
                      type="button"
                      class="location-edit-button"
                      :disabled="saving || deleting"
                      @click="locationEditOpen ? cancelLocationEditor() : openLocationEditor()"
                    >
                      {{ locationEditOpen ? '收起' : '编辑位置' }}
                    </button>
                  </div>

                  <div class="detail-items location-display">
                    <div class="detail-item">
                      <span class="item-label">位置</span>
                      <span class="item-value text-truncate" :class="{ 'text-muted': !image.location_name }">
                        {{ image.location_name || '未记录' }}
                      </span>
                    </div>
                    <div class="detail-item">
                      <span class="item-label">经纬度</span>
                      <span v-if="hasCoordinates" class="item-value font-mono">
                        {{ image.location_lat }}, {{ image.location_lng }}
                      </span>
                      <span v-else class="item-value text-muted">未记录</span>
                    </div>
                  </div>
                  <ReadOnlyMap
                    class="mt-3"
                    :lat="mapLat"
                    :lng="mapLng"
                    :label="image.location_name || image.title"
                    :interactive="locationEditOpen"
                    @pick="updateLocationFromMap"
                  />

                  <form v-if="locationEditOpen" class="location-edit-form" @submit.prevent="saveLocation">
                    <LocationSearch @select="applyLocationSearchResult" />
                    <label class="edit-field">
                      <span>位置名</span>
                      <input v-model="editForm.location_name" type="text" />
                    </label>
                    <div class="edit-grid">
                      <label class="edit-field">
                        <span>纬度</span>
                        <input v-model="editForm.location_lat" type="number" step="any" min="-90" max="90" />
                      </label>
                      <label class="edit-field">
                        <span>经度</span>
                        <input v-model="editForm.location_lng" type="number" step="any" min="-180" max="180" />
                      </label>
                    </div>
                    <p v-if="actionError" class="action-error">{{ actionError }}</p>
                    <div class="edit-actions">
                      <button type="submit" class="action-btn" :disabled="saving || deleting">
                        {{ saving ? '保存中…' : '保存位置' }}
                      </button>
                      <button type="button" class="action-btn muted" :disabled="saving || deleting" @click="cancelLocationEditor">
                        取消
                      </button>
                    </div>
                  </form>
                </section>

                <section class="detail-section">
                  <div class="section-title">
                    <svg :viewBox="ICONS.link.vb" fill="currentColor" class="section-icon" aria-hidden="true"><path :d="ICONS.link.d" /></svg>
                    <span>链接</span>
                  </div>
                  <div class="detail-items">
                    <div v-for="row in linkRows" :key="row.label" class="detail-item is-column">
                      <span class="item-label">{{ row.label }}</span>
                      <span class="item-value font-mono text-truncate">{{ row.value }}</span>
                      <button type="button" class="inline-copy" @click="copyValue(row.value, row.label)">
                        复制{{ row.label }}
                      </button>
                    </div>
                  </div>
                </section>

                <section class="detail-section">
                  <div class="section-title">
                    <svg :viewBox="ICONS.clock.vb" fill="currentColor" class="section-icon" aria-hidden="true"><path :d="ICONS.clock.d" /></svg>
                    <span>时间</span>
                  </div>
                  <div class="detail-items">
                    <div class="detail-item">
                      <span class="item-label">创建时间</span>
                      <span class="item-value text-muted">后续接入</span>
                    </div>
                    <div class="detail-item">
                      <span class="item-label">更新时间</span>
                      <span class="item-value text-muted">后续接入</span>
                    </div>
                  </div>
                </section>
              </div>
            </aside>
          </div>

          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.image-viewer-wrapper {
  position: fixed;
  inset: 0;
  z-index: 9000;
}

.cyber-image-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: rgba(15, 20, 25, 0.95);
  color: rgb(229, 231, 235);
}

.viewer-backdrop {
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    radial-gradient(circle at 20% 10%, rgba(96, 165, 250, 0.14), transparent 30%),
    radial-gradient(circle at 80% 90%, rgba(53, 243, 255, 0.1), transparent 30%),
    rgba(15, 20, 25, 0.94);
}

.viewer-container,
.viewer-content,
.image-canvas {
  position: absolute;
  inset: 0;
}

.viewer-container {
  z-index: 2;
}

.navigation-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  background: linear-gradient(180deg, rgba(15, 20, 25, 0.88), rgba(15, 20, 25, 0));
  pointer-events: none;
}

.viewer-esc-button {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 28px;
  border: 1px solid rgba(96, 165, 250, 0.26);
  border-radius: 4px;
  background: rgba(15, 20, 25, 0.82);
  color: rgb(226, 232, 240);
  font-family: 'Menlo', 'Consolas', 'Courier New', monospace;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: all 0.2s ease;
  pointer-events: auto;
}

.viewer-esc-button:hover {
  border-color: rgba(96, 165, 250, 0.58);
  background: rgba(96, 165, 250, 0.2);
  color: rgb(147, 197, 253);
  transform: translateY(-1px);
}

.nav-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  pointer-events: auto;
}

.viewer-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 4px;
  color: rgb(249, 250, 251);
  background: rgba(96, 165, 250, 0.2);
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.viewer-action-btn:hover:not(:disabled) {
  background: rgba(96, 165, 250, 0.32);
  color: rgb(147, 197, 253);
  transform: translateY(-1px);
}

.viewer-action-btn.is-success {
  color: rgb(132, 247, 153);
  background: rgba(132, 247, 153, 0.12);
}

.viewer-action-btn.is-active {
  color: rgb(147, 197, 253);
  background: rgba(96, 165, 250, 0.34);
}

.viewer-action-btn.danger {
  color: rgb(253, 164, 175);
  background: rgba(251, 113, 133, 0.13);
}

.viewer-action-btn.danger:hover:not(:disabled) {
  color: rgb(254, 205, 211);
  background: rgba(251, 113, 133, 0.28);
}

.viewer-action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.image-canvas {
  z-index: 3;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
  transition: right 0.3s ease;
}

.image-canvas.has-drawer {
  right: 420px;
}

.main-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  user-select: none;
}

.nav-arrow {
  position: absolute;
  top: 50%;
  z-index: 12;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid rgba(96, 165, 250, 0.24);
  border-radius: 4px;
  background: rgba(15, 20, 25, 0.86);
  color: rgb(249, 250, 251);
  cursor: pointer;
  backdrop-filter: blur(10px);
  transition: all 0.2s ease;
}

.nav-arrow-left {
  left: 24px;
}

.nav-arrow-right {
  right: 24px;
}

.nav-arrow:hover {
  border-color: rgba(96, 165, 250, 0.62);
  color: rgb(147, 197, 253);
  background: rgba(96, 165, 250, 0.2);
}

@media (max-width: 640px) {
  .navigation-bar {
    align-items: flex-start;
    flex-direction: column;
    padding: 14px;
  }
  .nav-actions {
    width: 100%;
    justify-content: flex-end;
  }
  .nav-arrow-left {
    left: 14px;
  }
  .nav-arrow-right {
    right: 14px;
  }
  .image-canvas.has-drawer {
    right: 0;
  }
}

.drawer-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 420px;
  background: rgba(7, 7, 19, 0.98);
  backdrop-filter: blur(24px);
  border-left: 1px solid rgba(53, 243, 255, 0.18);
  transform: translateX(100%);
  transition: transform 0.3s ease;
  z-index: 15;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: -8px 0 30px rgba(0, 0, 0, 0.55);
}
.drawer-panel.is-open {
  transform: translateX(0);
}
@media (max-width: 640px) {
  .drawer-panel {
    width: 100%;
  }
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(53, 243, 255, 0.12);
  flex-shrink: 0;
}
.drawer-title {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: rgb(53, 243, 255);
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.detail-section {
  margin-bottom: 20px;
  padding: 14px;
  border: 1px solid rgba(53, 243, 255, 0.2);
  border-radius: 6px;
  background: rgba(15, 20, 25, 0.35);
}
.detail-section:last-child {
  margin-bottom: 0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 10px;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(53, 243, 255, 0.15);
  font-size: 13px;
  font-weight: 700;
  color: rgb(165, 243, 252);
}
.section-title-with-action {
  justify-content: space-between;
}
.section-title-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.section-icon {
  width: 14px;
  height: 14px;
  color: rgb(103, 232, 249);
  flex-shrink: 0;
}

.detail-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  background: rgba(7, 7, 19, 0.55);
  border: 1px solid rgba(53, 243, 255, 0.1);
  border-radius: 4px;
}
.detail-item.is-column {
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}

.exif-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.exif-item.is-full {
  grid-column: 1 / -1;
}
@media (max-width: 420px) {
  .exif-grid {
    grid-template-columns: 1fr;
  }
}

.ai-edit-button,
.location-edit-button {
  border: 1px solid rgba(53, 243, 255, 0.22);
  border-radius: 4px;
  background: rgba(53, 243, 255, 0.06);
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 700;
  color: rgb(165, 243, 252);
  cursor: pointer;
}
.ai-edit-button:hover:not(:disabled),
.location-edit-button:hover:not(:disabled) {
  border-color: rgba(53, 243, 255, 0.42);
  background: rgba(53, 243, 255, 0.12);
}
.ai-edit-button:disabled,
.location-edit-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.ai-edit-form,
.location-edit-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
  border-top: 1px solid rgba(53, 243, 255, 0.12);
  padding-top: 12px;
}
.edit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.edit-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: rgba(103, 232, 249, 0.75);
}
.edit-field input,
.edit-field textarea {
  width: 100%;
  border: 1px solid rgba(53, 243, 255, 0.18);
  border-radius: 4px;
  background: rgba(7, 7, 19, 0.72);
  padding: 8px 9px;
  color: rgb(229, 231, 235);
  outline: none;
}
.edit-field textarea {
  resize: vertical;
}
.edit-field input:focus,
.edit-field textarea:focus {
  border-color: rgba(53, 243, 255, 0.65);
}
.edit-actions {
  display: flex;
  gap: 8px;
}
.action-btn,
.inline-copy {
  border: 1px solid rgba(53, 243, 255, 0.3);
  border-radius: 4px;
  background: rgba(53, 243, 255, 0.08);
  padding: 7px 10px;
  font-size: 12px;
  font-weight: 700;
  color: rgb(165, 243, 252);
  cursor: pointer;
}
.action-btn.danger {
  border-color: rgba(251, 113, 133, 0.35);
  background: rgba(251, 113, 133, 0.09);
  color: rgb(253, 164, 175);
}
.action-btn.muted {
  border-color: rgba(148, 163, 184, 0.2);
  background: rgba(148, 163, 184, 0.06);
  color: rgba(203, 213, 225, 0.86);
}
.action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.action-error {
  margin: 0;
  font-size: 12px;
  color: rgb(251, 113, 133);
}

.item-label {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: rgba(103, 232, 249, 0.75);
}
.item-value {
  font-size: 12px;
  font-weight: 500;
  color: rgb(229, 231, 235);
  min-width: 0;
}
.detail-item:not(.is-column) .item-value {
  text-align: right;
}
.item-description {
  font-size: 12.5px;
  line-height: 1.65;
  color: rgb(203, 213, 225);
  margin: 0;
}
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tag-pill {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid rgba(53, 243, 255, 0.24);
  background: rgba(53, 243, 255, 0.08);
  color: rgb(165, 243, 252);
  font-size: 11px;
  font-weight: 700;
}
.dominant-color-value {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: rgb(229, 231, 235);
}
.dominant-color-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.palette-list {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
}
.palette-list::-webkit-scrollbar {
  display: none;
}
.palette-chip {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.18);
}
.dominant-color-chip {
  width: 18px;
  height: 18px;
}
.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}
.font-mono {
  font-family: 'Menlo', 'Consolas', 'Courier New', monospace;
}
.text-muted {
  color: rgba(148, 163, 184, 0.7);
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 11px;
  color: rgb(53, 243, 255);
  background: rgba(53, 243, 255, 0.1);
  border: 1px solid rgba(53, 243, 255, 0.25);
  border-radius: 4px;
}
.badge.badge-lime {
  color: rgb(132, 247, 153);
  background: rgba(132, 247, 153, 0.1);
  border-color: rgba(132, 247, 153, 0.3);
}
.badge.badge-muted {
  color: rgba(148, 163, 184, 0.85);
  background: rgba(148, 163, 184, 0.08);
  border-color: rgba(148, 163, 184, 0.2);
}

.lightbox-enter-active,
.lightbox-leave-active {
  transition: all 0.25s ease;
}
.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
</style>
