import { ref, watch, type Ref } from 'vue';

import type { GeocodeResult } from '@/features/images/geocode.api';
import type { UploadEntry } from './useUploadQueue';

interface UseUploadLocationSyncOptions {
  entries: Ref<UploadEntry[]>;
  currentEntry: Readonly<Ref<UploadEntry | null>>;
  syncMarker: (center?: boolean) => void;
  setEntryCoordinates: (
    entry: UploadEntry,
    lat: number | null,
    lng: number | null,
    centerMap?: boolean,
  ) => void;
}

export const useUploadLocationSync = ({
  entries,
  currentEntry,
  syncMarker,
  setEntryCoordinates,
}: UseUploadLocationSyncOptions) => {
  const syncLocation = ref<boolean>(false);

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

  return {
    syncLocation,
    broadcastLocationInto,
    broadcastLocationToAll,
    updateLat,
    updateLng,
    clearLocation,
    setIsPublic,
    setLocationPublic,
    applyLocationSearchResult,
  };
};
