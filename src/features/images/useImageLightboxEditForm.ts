import { reactive, ref } from 'vue';

import type { MapRegion } from '@/features/upload/map-coordinate';
import type { AiPreviewResult } from './ai-preview.api';
import type { GeocodeRegion, GeocodeResult } from './geocode.api';
import type { ImageRecord } from './image.types';
import { paletteFromImage, tagsFromImage } from './image-meta';

export interface ImageLightboxEditForm {
  title: string;
  caption: string;
  tags: string;
  dominant_color: string;
  palette: string;
  composition: string;
  location_name: string;
  location_lat: number | '';
  location_lng: number | '';
  location_region: MapRegion | null;
  is_public: 0 | 1;
  location_public: 0 | 1;
}

export const tagsTextFromImage = (image: ImageRecord | null | undefined): string =>
  tagsFromImage(image).join(', ');

export const paletteTextFromImage = (image: ImageRecord | null | undefined): string =>
  paletteFromImage(image).join(', ');

export const applyAiPreviewResultToEditForm = (
  editForm: ImageLightboxEditForm,
  result: AiPreviewResult,
) => {
  editForm.title = result.title || editForm.title;
  editForm.caption = result.caption;
  editForm.tags = result.tags.join(', ');
  editForm.dominant_color = result.dominant_color;
  editForm.palette = result.palette.join(', ');
  editForm.composition = result.composition;
};

export const toRegion = (value: string | null | undefined): MapRegion | null =>
  value === 'china' || value === 'global' ? value : null;

export const regionFromSearchRegion = (region: GeocodeRegion): MapRegion => (region === 'cn' ? 'china' : 'global');

export const searchRegionFromMapRegion = (region: MapRegion | null | undefined): GeocodeRegion =>
  region === 'global' ? 'global' : 'cn';

export const toMapCoordinate = (value: number | string | null | undefined): number | null => {
  if (value === '' || value == null) return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
};

export const useImageLightboxEditForm = () => {
  const editSearchRegion = ref<GeocodeRegion>('cn');
  const editForm = reactive<ImageLightboxEditForm>({
    title: '',
    caption: '',
    tags: '',
    dominant_color: '',
    palette: '',
    composition: '',
    location_name: '',
    location_lat: '',
    location_lng: '',
    location_region: null,
    is_public: 1,
    location_public: 1,
  });

  const syncEditRegionFromSearch = () => {
    const lat = editForm.location_lat === '' ? null : Number(editForm.location_lat);
    const lng = editForm.location_lng === '' ? null : Number(editForm.location_lng);
    editForm.location_region =
      lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)
        ? null
        : regionFromSearchRegion(editSearchRegion.value);
  };

  const onEditSearchRegionChange = (region: GeocodeRegion) => {
    editSearchRegion.value = region;
    syncEditRegionFromSearch();
  };

  const resetForm = (image: ImageRecord | null | undefined) => {
    editForm.title = image?.title ?? '';
    editForm.caption = image?.caption ?? '';
    editForm.tags = tagsTextFromImage(image);
    editForm.dominant_color = image?.dominant_color ?? '';
    editForm.palette = paletteTextFromImage(image);
    editForm.composition = image?.composition ?? '';
    editForm.location_name = image?.location_name ?? '';
    editForm.location_lat = image?.location_lat ?? '';
    editForm.location_lng = image?.location_lng ?? '';
    editForm.location_region = toRegion(image?.location_region);
    editSearchRegion.value = searchRegionFromMapRegion(editForm.location_region);
    editForm.is_public = image?.is_public === 0 ? 0 : 1;
    editForm.location_public = image?.location_public === 0 ? 0 : 1;
  };

  const updateLocationFromMap = (coords: { lat: number; lng: number }) => {
    editForm.location_lat = coords.lat;
    editForm.location_lng = coords.lng;
    syncEditRegionFromSearch();
  };

  const applyLocationSearchResult = (result: GeocodeResult) => {
    editForm.location_name = result.name;
    editForm.location_lat = result.lat;
    editForm.location_lng = result.lng;
    syncEditRegionFromSearch();
  };

  return {
    editForm,
    editSearchRegion,
    resetForm,
    syncEditRegionFromSearch,
    onEditSearchRegionChange,
    updateLocationFromMap,
    applyLocationSearchResult,
  };
};
