import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const amapLoader = readFileSync('src/features/upload/amap.ts', 'utf8');
const uploadView = readFileSync('src/features/upload/UploadView.vue', 'utf8');
const readOnlyMap = readFileSync('src/features/images/ReadOnlyMap.vue', 'utf8');
const hiveView = readFileSync('src/features/hive/HiveView.vue', 'utf8');
const mapboxLoader = readFileSync('src/features/hive/mapbox.ts', 'utf8');
const footprintMap = readFileSync('src/features/hive/footprint-map.ts', 'utf8');

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

test('upload and read-only maps use AMap JS API instead of MapLibre styles', () => {
  for (const source of [uploadView, readOnlyMap]) {
    assert.match(source, /loadAmap/);
    assert.match(source, /new amap\.Map/);
    assert.doesNotMatch(source, /maplibre-gl|primaryMapStyleForRegion|RASTER_FALLBACK_STYLE|setStyle/);
  }
});

test('footprint page splits into AMap (domestic) and Mapbox (overseas) maps', () => {
  assert.match(hiveView, /groupFootprints/);
  assert.match(hiveView, /FootprintFlatMap/);
  assert.match(hiveView, /domesticFootprints/);
  assert.match(hiveView, /overseasFootprints/);
  // 容器本身不直接建图，地图源差异收敛到 footprint-map.ts 的两个 adapter
  assert.doesNotMatch(hiveView, /new amap\.Map|new maplibregl\.Map/);
  assert.match(footprintMap, /loadAmap/);
  assert.match(footprintMap, /new amap\.Map/);
  assert.match(footprintMap, /amap:\/\/styles\//);
  assert.match(footprintMap, /mapLngLatFromStored/);
  assert.match(footprintMap, /loadMapboxToken/);
  assert.match(footprintMap, /new maplibregl\.Map/);
  assert.match(mapboxLoader, /api\.mapbox\.com\/styles\/v1/);
  assert.match(mapboxLoader, /MAPBOX_STYLE_ID = 'mapbox\//);
  assert.match(mapboxLoader, /tileSize: 512/);
});

test('AMap maps keep WGS84 storage and GCJ-02 display conversion', () => {
  assert.match(uploadView, /mapLngLatFromStored/);
  assert.match(uploadView, /storedLngLatFromMap/);
  assert.match(readOnlyMap, /mapLngLatFromStored/);
  assert.match(readOnlyMap, /storedLngLatFromMap/);
});

test('single image maps use pin markers anchored at the coordinate point', () => {
  for (const source of [uploadView, readOnlyMap]) {
    assert.match(source, /map-location-pin/);
    assert.match(source, /map-location-pin-dot/);
    assert.match(source, /anchor:\s*'bottom-center'/);
    assert.match(source, /clip-path:\s*polygon/);
  }
});
