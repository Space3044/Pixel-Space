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
  assert.match(view, /class="point-image-list/);
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
  assert.match(view, /\.footprint-hero\s*\{[^}]*align-items:\s*flex-start;/s);
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

test('HiveView only shows the right side detail after a map point is selected', () => {
  assert.match(view, /const activeFootprint = computed\(\(\) =>\s*footprints\.value\.find\(\(footprint\) => footprint\.key === activeFootprintKey\.value\) \?\? null,/s);
  assert.match(view, /activeFootprintKey\.value = null/);
  assert.match(view, /class="flat-layout"\s*:class="\{ 'has-selection': activeFootprint \}"/);
  assert.match(view, /<aside v-if="activeFootprint" class="footprint-side">/);
  assert.doesNotMatch(view, /上传并标记位置后，这里会显示最近点亮的地点。/);
  assert.match(view, /marker\.addEventListener\('click',\s*\(\) => selectFootprint\(footprint\)\)/);
});

test('HiveView right panel lists only images from the selected footprint', () => {
  assert.match(view, /v-for="pointImage in activeFootprint\.images"/);
  assert.match(view, /:href="`\/p\/\$\{encodeURIComponent\(pointImage\.key\)\}`"/);
  assert.match(view, /activeFootprint\.images\.length\s*\}\}\s*张图片/);
  assert.doesNotMatch(view, /v-for="footprint in footprints"/);
  assert.match(view, /\.active-point\s*\{[^}]*grid-template-columns:\s*5\.5rem minmax\(0,\s*1fr\);/s);
  assert.match(view, /\.active-cover\s*\{[^}]*width:\s*5\.5rem;[^}]*height:\s*5\.5rem;/s);
  assert.match(view, /\.flat-layout\.has-selection\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(28rem,\s*34rem\);/s);
});

test('HiveView can reset the flat map back to the full overview', () => {
  assert.match(view, /const resetFlatMapView = \(\) => \{/);
  assert.match(view, /activeFootprintKey\.value = null;\s*hoveredFootprintKey\.value = null;/);
  assert.match(view, /fitFlatMapToFootprints\(\);/);
  assert.match(view, /class="map-overview-button"/);
  assert.match(view, /@click="resetFlatMapView"/);
  assert.match(view, />\s*返回总览\s*</);
});

test('HiveView removes the popup and link outer frame', () => {
  assert.match(view, /:deep\(\.maplibregl-popup-content\)\s*\{[^}]*border:\s*0;/s);
  assert.match(view, /:deep\(\.footprint-popup-body a\)\s*\{[^}]*border:\s*0;[^}]*outline:\s*none;[^}]*box-shadow:\s*none;/s);
  assert.match(view, /:deep\(\.footprint-popup-body a:focus-visible\)\s*\{[^}]*outline:\s*none;[^}]*text-decoration:\s*underline;/s);
});
