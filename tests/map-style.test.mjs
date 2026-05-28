import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const amapLoader = readFileSync('src/features/upload/amap.ts', 'utf8');
const uploadView = readFileSync('src/features/upload/UploadView.vue', 'utf8');
const readOnlyMap = readFileSync('src/features/images/ReadOnlyMap.vue', 'utf8');
const hiveView = readFileSync('src/features/hive/HiveView.vue', 'utf8');

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

test('maps use AMap JS API instead of MapLibre styles', () => {
  for (const source of [uploadView, readOnlyMap, hiveView]) {
    assert.match(source, /loadAmap/);
    assert.match(source, /new amap\.Map/);
    assert.doesNotMatch(source, /maplibre-gl|primaryMapStyleForRegion|RASTER_FALLBACK_STYLE|setStyle/);
  }
});

test('AMap maps keep WGS84 storage and GCJ-02 display conversion', () => {
  assert.match(uploadView, /mapLngLatFromStored/);
  assert.match(uploadView, /storedLngLatFromMap/);
  assert.match(readOnlyMap, /mapLngLatFromStored/);
  assert.match(readOnlyMap, /storedLngLatFromMap/);
  assert.match(hiveView, /mapLngLatFromStored/);
});

test('single image maps use pin markers anchored at the coordinate point', () => {
  for (const source of [uploadView, readOnlyMap]) {
    assert.match(source, /map-location-pin/);
    assert.match(source, /map-location-pin-dot/);
    assert.match(source, /anchor:\s*'bottom-center'/);
    assert.match(source, /clip-path:\s*polygon/);
  }
});
