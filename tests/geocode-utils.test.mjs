import assert from 'node:assert/strict';
import { dedupeGeocodeResults, validCoordinate } from '../shared/geocode.ts';

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('validCoordinate accepts numeric strings and rejects out-of-range values', () => {
  assert.equal(validCoordinate('31.2304', -90, 90), 31.2304);
  assert.equal(validCoordinate(121.4737, -180, 180), 121.4737);
  assert.equal(validCoordinate('bad', -90, 90), null);
  assert.equal(validCoordinate(200, -180, 180), null);
});

test('dedupeGeocodeResults removes duplicate names at rounded coordinates', () => {
  assert.deepEqual(
    dedupeGeocodeResults([
      { name: '上海', lat: 31.2304, lng: 121.4737 },
      { name: '上海', lat: 31.2304001, lng: 121.4737001 },
      { name: '巴黎', lat: 48.8566, lng: 2.3522 },
    ]),
    [
      { name: '上海', lat: 31.2304, lng: 121.4737 },
      { name: '巴黎', lat: 48.8566, lng: 2.3522 },
    ],
  );
});
