import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const amapLoader = readFileSync('src/features/upload/amap.ts', 'utf8');
const uploadView = [
  readFileSync('src/features/upload/UploadView.vue', 'utf8'),
  readFileSync('src/features/upload/upload-view.css', 'utf8'),
].join('\n');
const pickMap = readFileSync('src/features/upload/pick-map.ts', 'utf8');
const readOnlyMap = readFileSync('src/features/images/ReadOnlyMap.vue', 'utf8');
const footprintsView = readFileSync('src/features/footprints/FootprintsView.vue', 'utf8');
const mapboxLoader = readFileSync('src/features/footprints/mapbox.ts', 'utf8');
const footprintMap = readFileSync('src/features/footprints/footprint-map.ts', 'utf8');

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('AMap loader uses the official JS API loader with zh_cn language', () => {
  assert.match(amapLoader, /AMAP_LOADER_URL = 'https:\/\/webapi\.amap\.com\/loader\.js'/);
  assert.match(amapLoader, /\/api\/amap-config/);
  assert.match(amapLoader, /AMapLoader\.load/);
  assert.match(amapLoader, /version:\s*'2\.0'/);
  assert.match(amapLoader, /lang:\s*'zh_cn'/);
  assert.match(amapLoader, /const AMAP_PLUGINS = \[[^\]]*'AMap\.ToolBar'[^\]]*'AMap\.Scale'[^\]]*\]/s);
  assert.match(amapLoader, /plugins:\s*AMAP_PLUGINS/);
  assert.match(amapLoader, /'AMap\.PlaceSearch'/);
  assert.match(amapLoader, /'AMap\.Geocoder'/);
});

test('read-only single image map stays static until editing and reuses picker map adapters', () => {
  assert.match(readOnlyMap, /createChinaPickAdapter/);
  assert.match(readOnlyMap, /createWorldPickAdapter/);
  assert.match(readOnlyMap, /interactiveRegion/);
  assert.match(readOnlyMap, /props\.region === 'global' \? 'global' : 'china'/);
  assert.doesNotMatch(readOnlyMap, /new amap\.Map|new maplibregl\.Map/);
});

test('upload picker splits into AMap (domestic) and Mapbox (overseas) maps', () => {
  // 容器不直接建图，引擎差异收敛到 pick-map.ts 的两个 adapter
  assert.doesNotMatch(uploadView, /new amap\.Map|new maplibregl\.Map/);
  assert.match(uploadView, /createChinaPickAdapter/);
  assert.match(uploadView, /createWorldPickAdapter/);
  assert.match(pickMap, /loadAmap/);
  assert.match(pickMap, /new amap\.Map/);
  assert.match(pickMap, /amap:\/\/styles\/grey/);
  assert.match(pickMap, /loadMaplibre/);
  assert.match(pickMap, /loadMapboxToken/);
  assert.match(pickMap, /const maplibregl = await loadMaplibre\(\)/);
  assert.match(pickMap, /new maplibregl\.Map/);
  assert.match(pickMap, /mapboxRasterStyle/);
});

test('footprint page splits into AMap (domestic) and Mapbox (overseas) maps', () => {
  assert.match(footprintsView, /groupFootprints/);
  assert.match(footprintsView, /FootprintFlatMap/);
  assert.match(footprintsView, /domesticFootprints/);
  assert.match(footprintsView, /overseasFootprints/);
  // 容器本身不直接建图，地图源差异收敛到 footprint-map.ts 的两个 adapter
  assert.doesNotMatch(footprintsView, /new amap\.Map|new maplibregl\.Map/);
  assert.match(footprintMap, /loadAmap/);
  assert.match(footprintMap, /new amap\.Map/);
  assert.match(footprintMap, /amap:\/\/styles\//);
  assert.match(footprintMap, /mapLngLatFromStored/);
  assert.match(footprintMap, /loadMaplibre/);
  assert.match(footprintMap, /loadMapboxToken/);
  assert.match(footprintMap, /const maplibregl = await loadMaplibre\(\)/);
  assert.match(footprintMap, /new maplibregl\.Map/);
  assert.doesNotMatch(mapboxLoader, /import maplibregl from 'maplibre-gl'/);
  assert.match(mapboxLoader, /export const loadMaplibre/);
  assert.match(mapboxLoader, /import\('maplibre-gl'\)/);
  assert.match(mapboxLoader, /import\('maplibre-gl\/dist\/maplibre-gl\.css'\)/);
  assert.match(mapboxLoader, /api\.mapbox\.com\/styles\/v1/);
  assert.match(mapboxLoader, /MAPBOX_STYLE_ID = 'mapbox\//);
  assert.match(mapboxLoader, /tileSize: 512/);
});

test('AMap maps keep WGS84 storage and GCJ-02 display conversion', () => {
  assert.match(pickMap, /mapLngLatFromStored/);
  assert.match(pickMap, /storedLngLatFromMap/);
  assert.match(readOnlyMap, /type LngLat/);
  assert.match(readOnlyMap, /currentStoredCoordinate/);
});

test('single image maps use pin markers anchored at the coordinate point', () => {
  assert.match(readOnlyMap, /map-location-pin/);
  assert.match(readOnlyMap, /map-location-pin-dot/);
  assert.match(readOnlyMap, /clip-path:\s*polygon/);

  // 取景图样式留在 UploadView，标记创建移到 pick-map：高德锚点 bottom-center、Mapbox 锚点 bottom
  assert.match(uploadView, /map-location-pin/);
  assert.match(uploadView, /clip-path:\s*polygon/);
  assert.match(pickMap, /map-location-pin/);
  assert.match(pickMap, /anchor:\s*'bottom-center'/);
  assert.match(pickMap, /anchor:\s*'bottom'/);
});

test('upload picker focuses selected locations at an about 2km viewport', () => {
  assert.match(pickMap, /const PICK_FOCUS_ZOOM = 14/);
  assert.match(pickMap, /setZoomAndCenter\(Math\.max\(map\.getZoom\(\), PICK_FOCUS_ZOOM\), position\)/);
  assert.match(pickMap, /flyTo\(\{ center: position, zoom: Math\.max\(map\.getZoom\(\), PICK_FOCUS_ZOOM\) \}\)/);
});
