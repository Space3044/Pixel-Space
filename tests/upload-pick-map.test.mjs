import assert from 'node:assert/strict';
import { computed, ref } from 'vue';
import {
  geocodeRegionForCoordinate,
  regionFromPickRegion,
  searchRegionFromMapRegion,
  useUploadPickMap,
} from '../src/features/upload/useUploadPickMap.ts';

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const createEntry = (id, region = null) => ({
  id,
  meta: {
    location_lat: null,
    location_lng: null,
    location_region: region,
  },
});

const createAdapter = (calls) => {
  let pickHandler = null;
  return {
    async init(container, onReady, onPick) {
      calls.push(['init', container]);
      pickHandler = onPick;
      onReady();
    },
    setMarker(stored, center) {
      calls.push(['setMarker', stored, center]);
    },
    resize() {
      calls.push(['resize']);
    },
    destroy() {
      calls.push(['destroy']);
    },
    pick(stored) {
      pickHandler?.(stored);
    },
  };
};

const createDeferredAdapter = (calls) => {
  let readyHandler = null;
  let pickHandler = null;
  let ready = false;
  return {
    async init(container, onReady, onPick) {
      calls.push(['init', container]);
      readyHandler = onReady;
      pickHandler = onPick;
    },
    setMarker(stored, center) {
      if (!ready) return;
      calls.push(['setMarker', stored, center]);
    },
    resize() {
      calls.push(['resize']);
    },
    destroy() {
      calls.push(['destroy']);
    },
    ready() {
      ready = true;
      readyHandler?.();
    },
    pick(stored) {
      pickHandler?.(stored);
    },
  };
};

await test('useUploadPickMap maps search regions and writes selected coordinates', async () => {
  assert.equal(regionFromPickRegion('cn'), 'china');
  assert.equal(regionFromPickRegion('global'), 'global');
  assert.equal(searchRegionFromMapRegion('china'), 'cn');
  assert.equal(searchRegionFromMapRegion('global'), 'global');
  assert.equal(searchRegionFromMapRegion(null), 'cn');
  assert.equal(geocodeRegionForCoordinate(48.8566, 2.3522), 'global');

  const entry = createEntry('e_1');
  const currentEntry = computed(() => entry);
  const calls = [];
  const adapter = createAdapter(calls);
  const picker = useUploadPickMap({
    currentEntry,
    createChinaAdapter: () => adapter,
    createWorldAdapter: () => createAdapter(calls),
  });

  picker.mapRef.value = {};
  await picker.mountMap();

  picker.setEntryCoordinates(entry, 31.2304, 121.4737, true);

  assert.equal(entry.meta.location_lat, 31.2304);
  assert.equal(entry.meta.location_lng, 121.4737);
  assert.equal(entry.meta.location_region, 'china');
  assert.deepEqual(calls.at(-1), ['setMarker', { lng: 121.4737, lat: 31.2304 }, true]);

  await picker.onSearchRegionChange('global');
  picker.setEntryCoordinates(entry, 48.8566, 2.3522, false);

  assert.equal(entry.meta.location_region, 'global');
  assert.equal(picker.pickRegion.value, 'global');
});

await test('useUploadPickMap remounts adapters when selected entry restores another map region', async () => {
  const current = ref(createEntry('e_1', 'china'));
  const calls = [];
  const chinaAdapter = createAdapter(calls);
  const worldAdapter = createAdapter(calls);
  const picker = useUploadPickMap({
    currentEntry: current,
    createChinaAdapter: () => chinaAdapter,
    createWorldAdapter: () => worldAdapter,
  });

  picker.mapRef.value = {};
  await picker.mountMap();
  await picker.syncPickRegionFromEntry(createEntry('e_2', 'global'));

  assert.equal(picker.pickRegion.value, 'global');
  assert.deepEqual(calls.map((call) => call[0]), ['init', 'setMarker', 'destroy', 'init', 'setMarker']);

  worldAdapter.pick({ lat: 35.6764, lng: 139.65 });

  assert.equal(current.value.meta.location_lat, 35.6764);
  assert.equal(current.value.meta.location_lng, 139.65);
  assert.equal(current.value.meta.location_region, 'global');
});

await test('useUploadPickMap preserves centering when coordinates arrive during a region remount', async () => {
  const current = ref(createEntry('e_1', 'china'));
  const calls = [];
  const chinaAdapter = createAdapter(calls);
  const worldAdapter = createDeferredAdapter(calls);
  const picker = useUploadPickMap({
    currentEntry: current,
    createChinaAdapter: () => chinaAdapter,
    createWorldAdapter: () => worldAdapter,
  });

  picker.mapRef.value = {};
  await picker.mountMap();

  void picker.onSearchRegionChange('global');
  picker.setEntryCoordinates(current.value, 48.85837, 2.294481, true, 'global');
  worldAdapter.ready();

  assert.deepEqual(calls.at(-1), ['setMarker', { lng: 2.294481, lat: 48.85837 }, true]);
});
