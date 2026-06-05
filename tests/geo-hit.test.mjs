import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildGeoHitIndex,
  findRegionByLngLat,
  lngLatToVector,
  vectorToLngLat,
} from '../src/features/footprints/geo-hit.ts';

const world = JSON.parse(readFileSync('public/maps/world.zh.json', 'utf8'));
const china = JSON.parse(readFileSync('public/maps/china.json', 'utf8'));
const index = buildGeoHitIndex(world, china);

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('geo hit index resolves Chinese provinces by exact polygon containment', () => {
  assert.equal(findRegionByLngLat(index, 38.0428, 114.5149), '中国-河北');
  assert.equal(findRegionByLngLat(index, 38, 115), '中国-河北');
});

test('geo hit index resolves small or enclosed countries before large neighbours', () => {
  assert.equal(findRegionByLngLat(index, -24.6282, 25.9231), '博茨瓦纳');
  assert.equal(findRegionByLngLat(index, -22, 24), '博茨瓦纳');
  assert.equal(findRegionByLngLat(index, -29.31, 27.48), '莱索托');
  assert.equal(findRegionByLngLat(index, -26.31, 31.14), '斯威士兰');
});

test('geo hit vector conversion round trips the globe raycast point', () => {
  const vector = lngLatToVector(114.5149, 38.0428, 2.01);
  const result = vectorToLngLat(vector.x, vector.y, vector.z);

  assert.ok(Math.abs(result.lng - 114.5149) < 0.000001);
  assert.ok(Math.abs(result.lat - 38.0428) < 0.000001);
});
