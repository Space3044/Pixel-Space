<script setup lang="ts">
import type { GeocodeRegion, GeocodeResult } from '@/features/images/geocode.api';
import UploadFileExifSection from './UploadFileExifSection.vue';
import UploadMetadataSection from './UploadMetadataSection.vue';
import UploadVisibilitySection from './UploadVisibilitySection.vue';
import type { MapLoadState } from './useUploadPickMap';
import type { UploadEntry } from './useUploadQueue';

defineProps<{
  currentEntry: UploadEntry | null;
  displayEntry: UploadEntry;
  displayFileName: string;
  hasCurrent: boolean;
  mapLoadState: MapLoadState;
  pickRegion: GeocodeRegion;
}>();

const emit = defineEmits<{
  applyLocationSearchResult: [result: GeocodeResult];
  clearLocation: [];
  mapElement: [element: HTMLElement | null];
  searchRegionChange: [region: GeocodeRegion];
  setIsPublic: [entry: UploadEntry, checked: boolean];
  setLocationPublic: [entry: UploadEntry, checked: boolean];
  triggerAi: [];
  updateLat: [event: Event];
  updateLng: [event: Event];
}>();
</script>

<template>
  <aside class="meta-sidebar cyber-panel">
    <UploadFileExifSection
      :current-entry="currentEntry"
      :display-entry="displayEntry"
      :display-file-name="displayFileName"
    />

    <UploadVisibilitySection
      :display-entry="displayEntry"
      :has-current="hasCurrent"
      @set-is-public="(entry, checked) => emit('setIsPublic', entry, checked)"
    />

    <UploadMetadataSection
      :current-entry="currentEntry"
      :display-entry="displayEntry"
      :has-current="hasCurrent"
      :map-load-state="mapLoadState"
      :pick-region="pickRegion"
      @trigger-ai="emit('triggerAi')"
      @set-location-public="(entry, checked) => emit('setLocationPublic', entry, checked)"
      @clear-location="emit('clearLocation')"
      @apply-location-search-result="emit('applyLocationSearchResult', $event)"
      @search-region-change="emit('searchRegionChange', $event)"
      @update-lat="emit('updateLat', $event)"
      @update-lng="emit('updateLng', $event)"
      @map-element="emit('mapElement', $event)"
    />
  </aside>
</template>

<style scoped src="./upload-view.css"></style>
