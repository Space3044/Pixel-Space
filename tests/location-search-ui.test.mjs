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
  assert.match(locationSearch, /defineEmits<\{ select:/);
  assert.match(locationSearch, /@submit\.prevent="runSearch"/);
  assert.match(locationSearch, /emit\('select', result\)/);
  assert.match(locationSearch, /搜索位置/);
  assert.match(locationSearch, /选择位置/);
  assert.doesNotMatch(locationSearch, /watch\(/);
});

test('geocode.api uses AMap JS API for domestic search and backend only for global search', () => {
  assert.match(geocodeApi, /export interface GeocodeResult/);
  assert.match(geocodeApi, /export type GeocodeRegion = 'cn' \| 'global'/);
  assert.match(geocodeApi, /export async function searchLocations/);
  assert.match(geocodeApi, /loadAmap/);
  assert.match(geocodeApi, /gcj02ToWgs84/);
  assert.match(geocodeApi, /if \(region === 'cn'\) return await searchAmapLocations\(trimmed\)/);
  assert.match(geocodeApi, /URLSearchParams\(\{ q: keyword, region: 'global' \}\)/);
  assert.match(geocodeApi, /\/api\/geocode\?\$\{params\.toString\(\)\}/);
});

test('geocode.api enriches domestic POI names with reverse geocoded administrative regions', () => {
  assert.match(geocodeApi, /getAddress/);
  assert.match(geocodeApi, /reverseGeocodeAmapLocation/);
  assert.match(geocodeApi, /enrichAmapPois/);
  assert.match(geocodeApi, /normalizeAmapPoi\(row, reverse\)/);
});

test('LocationSearch lets the user choose domestic or global geocoding', () => {
  assert.match(locationSearch, /import \{ searchLocations, type GeocodeRegion, type GeocodeResult \}/);
  assert.match(locationSearch, /const selectedRegion = ref<GeocodeRegion>\('cn'\)/);
  assert.match(locationSearch, /searchLocations\(keyword, selectedRegion\.value\)/);
  assert.match(locationSearch, /setRegion\('cn'\)/);
  assert.match(locationSearch, /setRegion\('global'\)/);
  assert.match(locationSearch, /国内/);
  assert.match(locationSearch, /国外/);
});

test('UploadView applies selected geocode result to location name and marker coordinates', () => {
  assert.match(upload, /import LocationSearch from '@\/features\/images\/LocationSearch\.vue'/);
  assert.match(upload, /import type \{ GeocodeResult \} from '@\/features\/images\/geocode\.api'/);
  assert.match(upload, /const applyLocationSearchResult = \(result: GeocodeResult\) => \{/);
  assert.match(upload, /meta\.location_name = result\.name/);
  assert.match(upload, /setEntryCoordinates\(entry, result\.lat, result\.lng, true\)/);
  assert.match(upload, /<LocationSearch class="location-search" @select="applyLocationSearchResult" \/>/);
});

test('ImageLightbox applies selected geocode result while editing location', () => {
  assert.match(lightbox, /import LocationSearch from '\.\/LocationSearch\.vue'/);
  assert.match(lightbox, /import type \{ GeocodeResult \} from '\.\/geocode\.api'/);
  assert.match(lightbox, /const applyLocationSearchResult = \(result: GeocodeResult\) => \{/);
  assert.match(lightbox, /editForm\.location_name = result\.name/);
  assert.match(lightbox, /editForm\.location_lat = result\.lat/);
  assert.match(lightbox, /editForm\.location_lng = result\.lng/);
  assert.match(lightbox, /<LocationSearch @select="applyLocationSearchResult" \/>/);
});
