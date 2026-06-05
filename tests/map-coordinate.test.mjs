import assert from 'node:assert/strict';
import { regionForCoordinate } from '../shared/geo-region.ts';
import {
  gcj02ToWgs84,
  mapLngLatFromStored,
  mapRegionForStoredCoordinate,
  storedLngLatFromMap,
  wgs84ToGcj02,
} from '../src/features/upload/map-coordinate.ts';

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('map coordinates convert stored WGS84 positions to GCJ-02 for Chinese tiles', () => {
  const shanghai = wgs84ToGcj02(121.4737, 31.2304);

  assert.ok(Math.abs(shanghai.lng - 121.4782) < 0.001);
  assert.ok(Math.abs(shanghai.lat - 31.2285) < 0.001);
  assert.deepEqual(mapLngLatFromStored({ lng: 121.4737, lat: 31.2304 }), shanghai);
});

test('picked map coordinates convert GCJ-02 back to stored WGS84', () => {
  const picked = { lng: 121.4782, lat: 31.2285 };
  const stored = gcj02ToWgs84(picked.lng, picked.lat);

  assert.ok(Math.abs(stored.lng - 121.4737) < 0.001);
  assert.ok(Math.abs(stored.lat - 31.2304) < 0.001);
  assert.deepEqual(storedLngLatFromMap(picked), stored);
});

test('map coordinate conversion leaves non-China coordinates unchanged', () => {
  const paris = { lng: 2.3522, lat: 48.8566 };

  assert.deepEqual(wgs84ToGcj02(paris.lng, paris.lat), paris);
  assert.deepEqual(gcj02ToWgs84(paris.lng, paris.lat), paris);
});

test('map region uses China as default and switches global for foreign coordinates', () => {
  assert.equal(mapRegionForStoredCoordinate(null), 'china');
  assert.equal(mapRegionForStoredCoordinate({ lng: 121.4737, lat: 31.2304 }), 'china');
  assert.equal(mapRegionForStoredCoordinate({ lng: 2.3522, lat: 48.8566 }), 'global');
  assert.equal(regionForCoordinate(null), null);
  assert.equal(regionForCoordinate({ lng: 121.4737, lat: 31.2304 }), 'china');
  assert.equal(regionForCoordinate({ lng: 2.3522, lat: 48.8566 }), 'global');
});
