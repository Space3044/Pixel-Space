import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const locationSearch = readFileSync('src/features/images/LocationSearch.vue', 'utf8');
const geocodeApi = readFileSync('src/features/images/geocode.api.ts', 'utf8');
const upload = readFileSync('src/features/upload/UploadView.vue', 'utf8');
const lightbox = readFileSync('src/features/images/ImageLightbox.vue', 'utf8');

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('LocationSearch searches only on submit and emits selected coordinates', () => {
  assert.match(locationSearch, /searchLocations/);
  assert.match(locationSearch, /defineEmits<\{[\s\S]*select:/);
  assert.match(locationSearch, /@submit\.prevent="runSearch"/);
  assert.match(locationSearch, /emit\('select', result\)/);
  assert.match(locationSearch, /搜索位置/);
  assert.match(locationSearch, /选择位置/);
  assert.doesNotMatch(locationSearch, /watch\(/);
});

test('geocode.api uses AMap JS API for domestic search and backend only for global search', () => {
  assert.match(geocodeApi, /type GeocodeResult/);
  assert.match(geocodeApi, /export type \{ GeocodeResult \}/);
  assert.match(geocodeApi, /export type GeocodeRegion = 'cn' \| 'global'/);
  assert.match(geocodeApi, /export async function searchLocations/);
  assert.match(geocodeApi, /loadAmap/);
  assert.match(geocodeApi, /gcj02ToWgs84/);
  assert.match(geocodeApi, /if \(region === 'cn'\) return await searchAmapLocations\(trimmed\)/);
  assert.match(geocodeApi, /URLSearchParams\(\{ q: keyword, region: 'global' \}\)/);
  assert.match(geocodeApi, /\/api\/admin\/geocode\?\$\{params\.toString\(\)\}/);
});

test('geocode.api enriches domestic POI names with reverse geocoded administrative regions', () => {
  assert.match(geocodeApi, /getAddress/);
  assert.match(geocodeApi, /reverseGeocodeAmapLocation/);
  assert.match(geocodeApi, /enrichAmapPois/);
  assert.match(geocodeApi, /normalizeAmapPoi\(row, reverse\)/);
});

test('geocode.api sends overseas reverse geocoding to the admin backend', () => {
  assert.match(geocodeApi, /reverseGeocodeGlobalLocation/);
  assert.match(geocodeApi, /URLSearchParams\(\{ lat: String\(lat\), lng: String\(lng\), region: 'global' \}\)/);
  assert.match(geocodeApi, /if \(region === 'global'\) return await reverseGeocodeGlobalLocation\(lat, lng\)/);
});

test('LocationSearch lets the user choose domestic or global geocoding', () => {
  assert.match(locationSearch, /import \{ searchLocations, type GeocodeRegion, type GeocodeResult \}/);
  assert.match(locationSearch, /const localRegion = ref<GeocodeRegion>\('cn'\)/);
  assert.match(locationSearch, /const selectedRegion = computed\(\(\) => props\.modelValue \?\? localRegion\.value\)/);
  assert.match(locationSearch, /searchLocations\(keyword, selectedRegion\.value\)/);
  assert.match(locationSearch, /setRegion\('cn'\)/);
  assert.match(locationSearch, /setRegion\('global'\)/);
  assert.match(locationSearch, /emit\('update:modelValue', region\)/);
  assert.match(locationSearch, /emit\('region-change', region\)/);
  assert.match(locationSearch, /国内/);
  assert.match(locationSearch, /国外/);
});

test('UploadView applies selected geocode result to location name and marker coordinates', () => {
  assert.match(upload, /import LocationSearch from '@\/features\/images\/LocationSearch\.vue'/);
  assert.match(upload, /import \{ reverseGeocodeLocation, type GeocodeRegion, type GeocodeResult \} from '@\/features\/images\/geocode\.api'/);
  assert.match(upload, /const applyLocationSearchResult = \(result: GeocodeResult\) => \{/);
  assert.match(upload, /meta\.location_name = result\.name/);
  assert.match(upload, /setEntryCoordinates\(entry, result\.lat, result\.lng, true\)/);
  assert.match(upload, /const onSearchRegionChange = \(region: GeocodeRegion\) =>/);
  assert.match(upload, /:model-value="pickRegion"[\s\S]*class="location-search"[\s\S]*@select="applyLocationSearchResult"[\s\S]*@region-change="onSearchRegionChange"/);
});

test('UploadView reverse geocodes EXIF coordinates with the detected overseas region', () => {
  assert.match(upload, /const geocodeRegionForCoordinate = \(lat: number, lng: number\): GeocodeRegion =>/);
  assert.match(upload, /const exifRegion = geocodeRegionForCoordinate\(nextExif\.location_lat, nextExif\.location_lng\)/);
  assert.match(upload, /reverseGeocodeLocation\(nextExif\.location_lat, nextExif\.location_lng, exifRegion\)/);
});

test('ImageLightbox applies selected geocode result while editing location', () => {
  assert.match(lightbox, /import LocationSearch from '\.\/LocationSearch\.vue'/);
  assert.match(lightbox, /import type \{ GeocodeRegion, GeocodeResult \} from '\.\/geocode\.api'/);
  assert.match(lightbox, /const applyLocationSearchResult = \(result: GeocodeResult\) => \{/);
  assert.match(lightbox, /editForm\.location_name = result\.name/);
  assert.match(lightbox, /editForm\.location_lat = result\.lat/);
  assert.match(lightbox, /editForm\.location_lng = result\.lng/);
  assert.match(lightbox, /:model-value="editSearchRegion"[\s\S]*@select="applyLocationSearchResult"[\s\S]*@region-change="onEditSearchRegionChange"/);
});

test('ImageLightbox restores the edit search region from the saved location region', () => {
  assert.match(lightbox, /const searchRegionFromMapRegion = \(region: MapRegion \| null \| undefined\): GeocodeRegion =>/);
  assert.match(lightbox, /locationEditOpen\.value \? regionFromSearchRegion\(editSearchRegion\.value\) : toRegion\(props\.image\?\.location_region\)/);
  assert.match(lightbox, /editSearchRegion\.value = searchRegionFromMapRegion\(editForm\.location_region\)/);
});
