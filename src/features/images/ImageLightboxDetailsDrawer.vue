<script setup lang="ts">
import type { MapRegion } from '@/features/upload/map-coordinate';
import type { GeocodeRegion, GeocodeResult } from './geocode.api';
import ImageLightboxAiSection from './ImageLightboxAiSection.vue';
import ImageLightboxBasicSection from './ImageLightboxBasicSection.vue';
import type { DetailRow, LinkRow } from './image-lightbox-detail-types';
import ImageLightboxExifSection from './ImageLightboxExifSection.vue';
import ImageLightboxLinksSection from './ImageLightboxLinksSection.vue';
import ImageLightboxLocationSection from './ImageLightboxLocationSection.vue';
import ImageLightboxTimeSection from './ImageLightboxTimeSection.vue';
import type { ImageRecord } from './image.types';
import type { ImageLightboxEditForm } from './useImageLightboxEditForm';

defineProps<{
  image?: ImageRecord | null;
  detailsOpen: boolean;
  aiEditOpen: boolean;
  locationEditOpen: boolean;
  saving: boolean;
  deleting: boolean;
  aiPreviewing: boolean;
  actionError: string | null;
  editForm: ImageLightboxEditForm;
  editSearchRegion: GeocodeRegion;
  exifRows: DetailRow[];
  aiTags: string[];
  aiPalette: string[];
  dominantColor: { name: string; hex: string };
  hasCoordinates: boolean;
  mapLat: number | null;
  mapLng: number | null;
  mapRegion: MapRegion | null;
  linkRows: LinkRow[];
  formatImageTimestamp: (value: string | null | undefined) => string;
}>();

const emit = defineEmits<{
  applyLocationSearchResult: [result: GeocodeResult];
  cancelAiEditor: [];
  cancelLocationEditor: [];
  copyValue: [value: string, label: string];
  editSearchRegionChange: [region: GeocodeRegion];
  rerunAiAnalysis: [];
  saveAiMetadata: [];
  saveLocation: [];
  saveVisibilityFlag: [field: 'is_public' | 'location_public', value: 0 | 1];
  syncEditRegionFromSearch: [];
  toggleAiEditor: [];
  toggleLocationEditor: [];
  updateLocationFromMap: [coords: { lat: number; lng: number }];
}>();
</script>

<template>
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
      <ImageLightboxBasicSection
        :image="image"
        :saving="saving"
        :deleting="deleting"
        @save-visibility-flag="(field, value) => emit('saveVisibilityFlag', field, value)"
      />

      <ImageLightboxExifSection :exif-rows="exifRows" />

      <ImageLightboxAiSection
        :image="image"
        :ai-edit-open="aiEditOpen"
        :saving="saving"
        :deleting="deleting"
        :ai-previewing="aiPreviewing"
        :action-error="actionError"
        :edit-form="editForm"
        :ai-tags="aiTags"
        :ai-palette="aiPalette"
        :dominant-color="dominantColor"
        @toggle-ai-editor="emit('toggleAiEditor')"
        @rerun-ai-analysis="emit('rerunAiAnalysis')"
        @cancel-ai-editor="emit('cancelAiEditor')"
        @save-ai-metadata="emit('saveAiMetadata')"
      />

      <ImageLightboxLocationSection
        :image="image"
        :location-edit-open="locationEditOpen"
        :saving="saving"
        :deleting="deleting"
        :action-error="actionError"
        :edit-form="editForm"
        :edit-search-region="editSearchRegion"
        :has-coordinates="hasCoordinates"
        :map-lat="mapLat"
        :map-lng="mapLng"
        :map-region="mapRegion"
        @toggle-location-editor="emit('toggleLocationEditor')"
        @cancel-location-editor="emit('cancelLocationEditor')"
        @save-location="emit('saveLocation')"
        @save-visibility-flag="(field, value) => emit('saveVisibilityFlag', field, value)"
        @sync-edit-region-from-search="emit('syncEditRegionFromSearch')"
        @edit-search-region-change="emit('editSearchRegionChange', $event)"
        @update-location-from-map="emit('updateLocationFromMap', $event)"
        @apply-location-search-result="emit('applyLocationSearchResult', $event)"
      />

      <ImageLightboxLinksSection
        :link-rows="linkRows"
        @copy-value="(value, label) => emit('copyValue', value, label)"
      />

      <ImageLightboxTimeSection
        :image="image"
        :format-image-timestamp="formatImageTimestamp"
      />
    </div>
  </aside>
</template>

<style scoped src="./image-lightbox.css"></style>
