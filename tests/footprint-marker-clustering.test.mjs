import assert from 'node:assert/strict';
import {
  clusterProjectedMarkers,
  createSpiderfyOffsets,
} from '../src/features/footprints/marker-clustering.ts';

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const point = (key, x, y, imagesCount = 1) => ({
  key,
  name: key,
  lng: x / 10,
  lat: y / 10,
  x,
  y,
  imagesCount,
});

test('clusterProjectedMarkers groups nearby screen points and totals image counts', () => {
  const clusters = clusterProjectedMarkers(
    [
      point('shanghai', 100, 100, 3),
      point('suzhou', 126, 112, 2),
      point('beijing', 360, 360, 4),
    ],
    { radius: 44 },
  );

  assert.equal(clusters.length, 2);
  assert.equal(clusters[0].kind, 'cluster');
  assert.deepEqual(clusters[0].points.map((item) => item.key), ['shanghai', 'suzhou']);
  assert.equal(clusters[0].imagesCount, 5);
  assert.equal(clusters[1].kind, 'single');
  assert.deepEqual(clusters[1].points.map((item) => item.key), ['beijing']);
});

test('clusterProjectedMarkers keeps separated points as singles', () => {
  const clusters = clusterProjectedMarkers(
    [
      point('paris', 80, 80),
      point('rome', 180, 80),
      point('tokyo', 280, 80),
    ],
    { radius: 44 },
  );

  assert.deepEqual(clusters.map((cluster) => cluster.kind), ['single', 'single', 'single']);
  assert.deepEqual(clusters.map((cluster) => cluster.id), ['paris', 'rome', 'tokyo']);
});

test('createSpiderfyOffsets returns centered offsets around a stable ring', () => {
  const offsets = createSpiderfyOffsets(4, { radius: 32 });

  assert.equal(offsets.length, 4);
  assert.deepEqual(offsets[0], { x: 32, y: 0 });
  assert.deepEqual(offsets[1], { x: 0, y: 32 });
  assert.deepEqual(offsets[2], { x: -32, y: 0 });
  assert.deepEqual(offsets[3], { x: 0, y: -32 });
});
