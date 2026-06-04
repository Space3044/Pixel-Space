import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const view = readFileSync('src/features/hive/HiveView.vue', 'utf8');
const flatMap = readFileSync('src/features/hive/FootprintFlatMap.vue', 'utf8');
const footprint = readFileSync('src/features/hive/footprint.ts', 'utf8');

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('HiveView is a container that splits footprints into domestic and overseas maps', () => {
  assert.match(view, /旅行足迹/);
  assert.match(view, /import\s+\{\s*groupFootprints[^}]*\}\s+from\s+'\.\/footprint'/);
  assert.match(view, /import\s+FootprintFlatMap\s+from\s+'\.\/FootprintFlatMap\.vue'/);
  assert.match(view, /import\s+WorldBoundaryGlobe\s+from\s+'\.\/WorldBoundaryGlobe\.vue'/);
  assert.match(view, /import\s+\{\s*listImages\s*\}\s+from\s+'@\/features\/images\/images\.api'/);
  assert.match(view, /const domesticFootprints = computed/);
  assert.match(view, /const overseasFootprints = computed/);
  assert.match(view, /footprint\.region === 'china'/);
  assert.match(view, /footprint\.region === 'global'/);
  // 地图源都在子组件/adapter 里，容器本身不直接 new 地图
  assert.doesNotMatch(view, /new amap\.Map|new maplibregl\.Map|loadAmap|loadMapboxToken/);
  assert.match(view, /source="china"/);
  assert.match(view, /source="world"/);
  assert.match(view, /class="dual-map-grid/);
  assert.match(view, /class="globe-boundary-card/);
  assert.match(view, /<WorldBoundaryGlobe\s+:visited-places="visitedPlaces"\s+:visited-coordinates="visitedCoordinates"/);
});

test('HiveView keeps the stats, selection detail and globe', () => {
  assert.match(view, /const footprints = computed\(\(\) => groupFootprints\(images\.value\)\)/);
  assert.match(view, /locatedCount/);
  assert.match(view, /unlocatedCount/);
  assert.match(view, /const activeFootprint = computed/);
  assert.match(view, /const selectFootprint = /);
  assert.match(view, /const resetSelection = /);
  assert.match(view, /v-if="activeFootprint" class="footprint-detail-card/);
  assert.match(view, /v-for="pointImage in activeFootprint\.images"/);
  assert.match(view, /:href="`\/p\/\$\{encodeURIComponent\(pointImage\.key\)\}`"/);
  assert.match(view, />\s*返回总览\s*</);
  assert.match(view, /const visitedPlaces = computed/);
  assert.match(view, /const visitedCoordinates = computed/);
});

test('FootprintFlatMap drives one map through a source adapter', () => {
  assert.match(flatMap, /createChinaAdapter/);
  assert.match(flatMap, /createWorldAdapter/);
  assert.match(flatMap, /footprint-marker/);
  assert.match(flatMap, /emit\('select'/);
  assert.match(flatMap, /emit\('preview'/);
  assert.match(flatMap, /adapter\.placeMarker/);
  assert.match(flatMap, /class="zoom-slider/);
  assert.doesNotMatch(flatMap, /new amap\.InfoWindow|maplibregl-popup/);
});

test('footprint grouping resolves region per point', () => {
  assert.match(footprint, /export const groupFootprints/);
  assert.match(footprint, /location_region === 'china'/);
  assert.match(footprint, /location_region === 'global'/);
  assert.match(footprint, /mapRegionForStoredCoordinate/);
  assert.match(footprint, /region:/);
});
