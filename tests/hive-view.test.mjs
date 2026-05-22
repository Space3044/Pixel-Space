import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const view = readFileSync('src/features/hive/HiveView.vue', 'utf8');

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('HiveView stacks the flat image map above the WorldHeatmap-style globe', () => {
  assert.match(view, /旅行足迹/);
  assert.match(view, /import\s+WorldBoundaryGlobe\s+from\s+'\.\/WorldBoundaryGlobe\.vue'/);
  assert.match(view, /import\s+\{\s*listImages\s*\}\s+from\s+'@\/features\/images\/images\.api'/);
  assert.match(view, /type\s+\{\s*ImageRecord\s*\}/);
  assert.match(view, /import 'maplibre-gl\/dist\/maplibre-gl\.css'/);
  assert.match(view, /MAP_STYLE_URL,\s*RASTER_FALLBACK_STYLE/);
  assert.match(view, /new maplibre\.Map/);
  assert.match(view, /new maplibre\.Marker/);
  assert.match(view, /new maplibre\.Popup/);
  assert.match(view, /class="stacked-map-layout/);
  assert.match(view, /class="flat-map-card/);
  assert.match(view, /class="globe-boundary-card/);
  assert.match(view, /<WorldBoundaryGlobe\s+:visited-places="visitedPlaces"\s+:visited-coordinates="visitedCoordinates"/);
  assert.match(view, /class="flat-map/);
  assert.match(view, /class="footprint-list/);
  assert.ok(view.indexOf('class="flat-map-card') < view.indexOf('class="globe-boundary-card'));
  assert.doesNotMatch(view, /HEX_COLS|HEX_ROWS|TOTAL_HEX|honeycomb|Hive Tips|hive-hex/);
});

test('HiveView removes redundant map and globe section labels', () => {
  assert.doesNotMatch(view, /<h2>平面地图<\/h2>/);
  assert.doesNotMatch(view, /<h2>边界地球<\/h2>/);
  assert.doesNotMatch(view, />仅边界</);
  assert.doesNotMatch(view, /class="globe-note"/);
  assert.doesNotMatch(view, /class="section-heading"/);
});

test('HiveView removes redundant hero title and active footprint copy', () => {
  assert.doesNotMatch(view, /<h1>旅行足迹<\/h1>/);
  assert.doesNotMatch(view, /class="hero-copy"/);
  assert.doesNotMatch(view, /这里收录了\s*\{\{\s*activeFootprint\.images\.length\s*\}\}\s*张图片，平面地图会定位到这个地点。/);
  assert.doesNotMatch(view, /\.footprint-hero h1/);
  assert.doesNotMatch(view, /\.hero-copy/);
});

test('HiveView derives lit locations from image coordinates', () => {
  assert.match(view, /const images = ref<ImageRecord\[\]>\(\[\]\)/);
  assert.match(view, /const footprints = computed/);
  assert.match(view, /location_lat !== null && image\.location_lng !== null/);
  assert.match(view, /location_name\?\.trim\(\)/);
  assert.match(view, /group\.images\.push\(image\)/);
  assert.match(view, /locatedImages\.length/);
  assert.match(view, /unlocatedCount/);
});

test('HiveView shows image positions only on the flat map', () => {
  assert.match(view, /footprint-marker/);
  assert.match(view, /hoveredFootprint/);
  assert.match(view, /selectFootprint\(footprint\)/);
  assert.match(view, /focusFlatMapOn\(footprint\)/);
  assert.match(view, /const visitedPlaces = computed/);
  assert.match(view, /const visitedCoordinates = computed/);
  assert.match(view, /lat:\s*footprint\.lat,\s*lng:\s*footprint\.lng/s);
  assert.doesNotMatch(view, /globeMap|renderGlobeMarkers|globeMarkers|createMarkerElement\(footprint,\s*'globe'\)|focusGlobeOn\(footprint\)/);
  assert.match(view, /footprint\.images\.length/);
  assert.match(view, /footprint\.cover\.public_url/);
});
