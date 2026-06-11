import { nextTick, ref, type Ref } from 'vue';

import type { GeocodeRegion } from '../images/geocode.api';
import { regionForCoordinate, type LngLat, type MapRegion } from './map-coordinate';
import type { PickMapAdapter } from './pick-map';

export type MapLoadState = 'loading' | 'ready';

interface UploadPickEntry {
  id: string;
  meta: {
    location_lat: number | null;
    location_lng: number | null;
    location_region: MapRegion | null;
  };
}

interface UseUploadPickMapOptions<Entry extends UploadPickEntry> {
  currentEntry: Readonly<Ref<Entry | null>>;
  createChinaAdapter: () => PickMapAdapter;
  createWorldAdapter: () => PickMapAdapter;
}

export const regionFromPickRegion = (region: GeocodeRegion): MapRegion => (region === 'cn' ? 'china' : 'global');

export const searchRegionFromMapRegion = (region: MapRegion | null | undefined): GeocodeRegion =>
  region === 'global' ? 'global' : 'cn';

export const geocodeRegionForCoordinate = (lat: number, lng: number): GeocodeRegion =>
  regionForCoordinate({ lng, lat }) === 'global' ? 'global' : 'cn';

export const useUploadPickMap = <Entry extends UploadPickEntry>({
  currentEntry,
  createChinaAdapter,
  createWorldAdapter,
}: UseUploadPickMapOptions<Entry>) => {
  const mapRef = ref<HTMLElement | null>(null);
  const mapLoadState = ref<MapLoadState>('loading');
  const pickRegion = ref<GeocodeRegion>('cn');
  let pickAdapter: PickMapAdapter | null = null;
  let pendingCenterOnReady = false;

  const currentStoredCoordinate = (): LngLat | null => {
    const entry = currentEntry.value;
    const lat = entry?.meta.location_lat ?? null;
    const lng = entry?.meta.location_lng ?? null;
    return lat === null || lng === null ? null : { lng, lat };
  };

  const syncMarker = (center = false) => {
    if (center && mapLoadState.value !== 'ready') pendingCenterOnReady = true;
    pickAdapter?.setMarker(currentStoredCoordinate(), center);
  };

  const setEntryCoordinates = (
    entry: Entry,
    lat: number | null,
    lng: number | null,
    centerMap = true,
    region: GeocodeRegion = pickRegion.value,
  ) => {
    entry.meta.location_lat = lat;
    entry.meta.location_lng = lng;
    entry.meta.location_region = lat === null || lng === null ? null : regionFromPickRegion(region);
    if (entry.id === currentEntry.value?.id) syncMarker(centerMap);
  };

  const mountMap = async () => {
    if (!mapRef.value || pickAdapter) return;
    mapLoadState.value = 'loading';
    const adapter = pickRegion.value === 'cn' ? createChinaAdapter() : createWorldAdapter();
    pickAdapter = adapter;
    await adapter.init(
      mapRef.value,
      () => {
        if (pickAdapter !== adapter) return;
        mapLoadState.value = 'ready';
        const shouldCenter = pendingCenterOnReady;
        pendingCenterOnReady = false;
        adapter.setMarker(currentStoredCoordinate(), shouldCenter);
      },
      (stored) => {
        const entry = currentEntry.value;
        if (!entry) return;
        setEntryCoordinates(entry, stored.lat, stored.lng, false);
      },
    );
  };

  const remountMap = async () => {
    pickAdapter?.destroy();
    pickAdapter = null;
    mapLoadState.value = 'loading';
    await mountMap();
  };

  const syncPickRegionFromEntry = async (entry: Entry | null) => {
    const nextRegion = searchRegionFromMapRegion(entry?.meta.location_region);
    if (nextRegion === pickRegion.value) return;
    pickRegion.value = nextRegion;
    await remountMap();
  };

  const onSearchRegionChange = async (region: GeocodeRegion) => {
    const shouldRemount = region !== pickRegion.value;
    pickRegion.value = region;
    const entry = currentEntry.value;
    if (entry && entry.meta.location_lat !== null && entry.meta.location_lng !== null) {
      entry.meta.location_region = regionFromPickRegion(region);
    }
    if (shouldRemount) await remountMap();
  };

  const syncCurrentEntryMap = () => {
    void nextTick(() => {
      if (!pickAdapter) {
        void mountMap();
        return;
      }
      syncMarker(true);
      pickAdapter.resize();
    });
  };

  const destroyMap = () => {
    pickAdapter?.destroy();
    pickAdapter = null;
  };

  return {
    mapRef,
    mapLoadState,
    pickRegion,
    currentStoredCoordinate,
    syncMarker,
    setEntryCoordinates,
    mountMap,
    remountMap,
    syncPickRegionFromEntry,
    onSearchRegionChange,
    syncCurrentEntryMap,
    destroyMap,
  };
};
