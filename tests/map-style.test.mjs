import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAP_STYLE_URL, RASTER_FALLBACK_STYLE } from '../src/features/upload/map-style.ts';

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('upload map keeps OpenFreeMap as primary style', () => {
  assert.equal(MAP_STYLE_URL, 'https://tiles.openfreemap.org/styles/fiord');
});

test('upload map has a no-token raster fallback when vector style fails', () => {
  assert.equal(RASTER_FALLBACK_STYLE.version, 8);
  assert.equal(RASTER_FALLBACK_STYLE.sources.cartoDark.type, 'raster');
  assert.deepEqual(RASTER_FALLBACK_STYLE.sources.cartoDark.tiles, [
    'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  ]);
  assert.match(RASTER_FALLBACK_STYLE.layers[0].id, /carto-dark/);
});

test('upload map waits for rendered tiles before cancelling fallback', () => {
  const view = readFileSync('src/features/upload/UploadView.vue', 'utf8');

  assert.match(view, /map\.once\('idle'/);
  assert.doesNotMatch(view, /map\.once\('load'/);
});
