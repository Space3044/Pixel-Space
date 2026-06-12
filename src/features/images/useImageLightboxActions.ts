import { ref, type Ref } from 'vue';

import { previewAiAnnotation } from './ai-preview.api';
import { buildPublicPageUrl } from './image-links';
import type { ImageRecord } from './image.types';
import { deleteImage, updateImage } from './images.api';
import {
  applyAiPreviewResultToEditForm,
  paletteTextFromImage,
  tagsTextFromImage,
  type ImageLightboxEditForm,
} from './useImageLightboxEditForm';

type ImageLightboxEmit = {
  (event: 'updated', image: ImageRecord): void;
  (event: 'deleted', key: string): void;
};

interface UseImageLightboxActionsOptions {
  image: Readonly<Ref<ImageRecord | null | undefined>>;
  origin: string;
  editForm: ImageLightboxEditForm;
  resetEditForm: (image: ImageRecord | null | undefined) => void;
  copyValue: (value: string, label: string) => Promise<void> | void;
  emit: ImageLightboxEmit;
}

const adminPublicImageUrl = (key: string): string => {
  const path = key
    .replace(/^\/+/, '')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `/api/admin/public/${path}`;
};

const extensionMimeType = (format: string): string => {
  const normalized = format.toLowerCase().replace(/^\./, '');
  if (normalized === 'jpg') return 'image/jpeg';
  if (normalized === 'svg') return 'image/svg+xml';
  return normalized ? `image/${normalized}` : 'image/webp';
};

const aiPreviewFileName = (image: ImageRecord): string => {
  const name = image.original_filename || image.key.split('/').pop() || 'image';
  return /\.[a-z0-9]+$/i.test(name) ? name : `${name}.${image.format || 'webp'}`;
};

export const useImageLightboxActions = ({
  image,
  origin,
  editForm,
  resetEditForm,
  copyValue,
  emit,
}: UseImageLightboxActionsOptions) => {
  const aiEditOpen = ref(false);
  const locationEditOpen = ref(false);
  const saving = ref(false);
  const deleting = ref(false);
  const aiPreviewing = ref(false);
  const actionError = ref<string | null>(null);

  const sharePage = async () => {
    if (!image.value) return;
    await copyValue(buildPublicPageUrl(image.value, origin), '分享链接');
  };

  const resetForm = (nextImage: ImageRecord | null | undefined) => {
    actionError.value = null;
    resetEditForm(nextImage);
  };

  const openAiEditor = () => {
    resetForm(image.value);
    aiEditOpen.value = true;
  };

  const cancelAiEditor = () => {
    resetForm(image.value);
    actionError.value = null;
    aiEditOpen.value = false;
  };

  const saveAiMetadata = async () => {
    if (!image.value) return;
    saving.value = true;
    actionError.value = null;
    try {
      const updated = await updateImage(image.value.key, {
        title: editForm.title,
        caption: editForm.caption,
        location_name: image.value.location_name ?? '',
        location_lat: image.value.location_lat,
        location_lng: image.value.location_lng,
        location_region: image.value.location_region,
        tags: editForm.tags,
        search_content: editForm.search_content,
        dominant_color: editForm.dominant_color,
        palette: editForm.palette,
        composition: editForm.composition,
        is_public: image.value.is_public === 0 ? 0 : 1,
        location_public: image.value.location_public === 0 ? 0 : 1,
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

  const rerunAiAnalysis = async () => {
    if (!image.value || !aiEditOpen.value || saving.value || deleting.value || aiPreviewing.value) return;
    aiPreviewing.value = true;
    actionError.value = null;
    try {
      const response = await fetch(adminPublicImageUrl(image.value.key));
      if (!response.ok) {
        throw new Error(`读取图片失败：${response.status}`);
      }
      const blob = await response.blob();
      const aiImage = new File(
        [blob],
        aiPreviewFileName(image.value),
        { type: blob.type || extensionMimeType(image.value.format) },
      );
      const result = await previewAiAnnotation(aiImage);
      applyAiPreviewResultToEditForm(editForm, result);
    } catch (error) {
      actionError.value = (error as Error).message || 'AI 分析失败。';
    } finally {
      aiPreviewing.value = false;
    }
  };

  const openLocationEditor = () => {
    resetForm(image.value);
    locationEditOpen.value = true;
  };

  const cancelLocationEditor = () => {
    resetForm(image.value);
    actionError.value = null;
    locationEditOpen.value = false;
  };

  const saveLocation = async () => {
    if (!image.value) return;
    saving.value = true;
    actionError.value = null;
    try {
      const updated = await updateImage(image.value.key, {
        title: image.value.title,
        caption: image.value.caption ?? '',
        location_name: editForm.location_name,
        location_lat: editForm.location_lat === '' ? null : Number(editForm.location_lat),
        location_lng: editForm.location_lng === '' ? null : Number(editForm.location_lng),
        location_region: editForm.location_region,
        tags: tagsTextFromImage(image.value),
        search_content: image.value.search_content ?? '',
        dominant_color: image.value.dominant_color ?? '',
        palette: paletteTextFromImage(image.value),
        composition: image.value.composition ?? '',
        is_public: editForm.is_public,
        location_public: editForm.location_public,
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
    if (!image.value) return;
    if (!confirm('确认删除这张图片？')) return;
    deleting.value = true;
    actionError.value = null;
    try {
      const key = image.value.key;
      await deleteImage(key);
      emit('deleted', key);
    } catch (error) {
      actionError.value = (error as Error).message;
    } finally {
      deleting.value = false;
    }
  };

  const saveVisibilityFlag = async (field: 'is_public' | 'location_public', next: 0 | 1) => {
    if (!image.value || saving.value || deleting.value) return;
    saving.value = true;
    actionError.value = null;
    try {
      const updated = await updateImage(image.value.key, {
        title: image.value.title,
        caption: image.value.caption ?? '',
        location_name: image.value.location_name ?? '',
        location_lat: image.value.location_lat,
        location_lng: image.value.location_lng,
        location_region: image.value.location_region,
        tags: tagsTextFromImage(image.value),
        search_content: image.value.search_content ?? '',
        dominant_color: image.value.dominant_color ?? '',
        palette: paletteTextFromImage(image.value),
        composition: image.value.composition ?? '',
        is_public: field === 'is_public' ? next : (image.value.is_public === 0 ? 0 : 1),
        location_public: field === 'location_public' ? next : (image.value.location_public === 0 ? 0 : 1),
      });
      emit('updated', updated);
      resetForm(updated);
    } catch (error) {
      actionError.value = (error as Error).message;
    } finally {
      saving.value = false;
    }
  };

  return {
    aiEditOpen,
    locationEditOpen,
    saving,
    deleting,
    aiPreviewing,
    actionError,
    sharePage,
    resetForm,
    openAiEditor,
    cancelAiEditor,
    saveAiMetadata,
    rerunAiAnalysis,
    openLocationEditor,
    cancelLocationEditor,
    saveLocation,
    deleteCurrentImage,
    saveVisibilityFlag,
  };
};
