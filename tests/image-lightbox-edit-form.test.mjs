import assert from 'node:assert/strict';
import {
  paletteTextFromImage,
  regionFromSearchRegion,
  searchRegionFromMapRegion,
  tagsTextFromImage,
  toMapCoordinate,
  useImageLightboxEditForm,
} from '../src/features/images/useImageLightboxEditForm.ts';

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const image = {
  key: 'images/cat.webp',
  title: 'Snow Cat',
  caption: 'Window light',
  original_filename: 'cat.jpg',
  public_url: '/api/public/images%2Fcat.webp',
  width: 1200,
  height: 800,
  format: 'webp',
  bytes_compressed: 2048,
  location_name: 'Paris',
  location_lat: 48.8566,
  location_lng: 2.3522,
  location_region: 'global',
  exif_taken_at: null,
  exif_camera: null,
  exif_iso: null,
  exif_aperture: null,
  exif_shutter: null,
  exif_focal_length: null,
  tags_json: '["cat"," snow "]',
  dominant_color: 'Blue #336699',
  color_palette_json: '["#336699"," #ffffff "]',
  composition: 'Centered',
  ai_status: 'done',
  tg_status: 'done',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  is_public: 0,
  location_public: 0,
  folder_id: null,
};

test('image lightbox edit form restores metadata and saved map region', () => {
  const state = useImageLightboxEditForm();

  state.resetForm(image);

  assert.equal(state.editForm.title, 'Snow Cat');
  assert.equal(state.editForm.caption, 'Window light');
  assert.equal(state.editForm.tags, 'cat, snow');
  assert.equal(state.editForm.palette, '#336699, #ffffff');
  assert.equal(state.editForm.location_name, 'Paris');
  assert.equal(state.editForm.location_lat, 48.8566);
  assert.equal(state.editForm.location_lng, 2.3522);
  assert.equal(state.editForm.location_region, 'global');
  assert.equal(state.editSearchRegion.value, 'global');
  assert.equal(state.editForm.is_public, 0);
  assert.equal(state.editForm.location_public, 0);
});

test('image lightbox edit form syncs map region from explicit search choice', () => {
  const state = useImageLightboxEditForm();
  state.resetForm(image);

  state.onEditSearchRegionChange('cn');

  assert.equal(state.editSearchRegion.value, 'cn');
  assert.equal(state.editForm.location_region, 'china');

  state.updateLocationFromMap({ lat: 35.6812, lng: 139.7671 });

  assert.equal(state.editForm.location_lat, 35.6812);
  assert.equal(state.editForm.location_lng, 139.7671);
  assert.equal(state.editForm.location_region, 'china');

  state.onEditSearchRegionChange('global');
  state.applyLocationSearchResult({ name: 'Tokyo', lat: 35.6764, lng: 139.65 });

  assert.equal(state.editForm.location_name, 'Tokyo');
  assert.equal(state.editForm.location_lat, 35.6764);
  assert.equal(state.editForm.location_lng, 139.65);
  assert.equal(state.editForm.location_region, 'global');
});

test('image lightbox edit form exposes shared region and text helpers', () => {
  assert.equal(regionFromSearchRegion('cn'), 'china');
  assert.equal(regionFromSearchRegion('global'), 'global');
  assert.equal(searchRegionFromMapRegion('china'), 'cn');
  assert.equal(searchRegionFromMapRegion('global'), 'global');
  assert.equal(searchRegionFromMapRegion(null), 'cn');
  assert.equal(toMapCoordinate('31.2'), 31.2);
  assert.equal(toMapCoordinate(''), null);
  assert.equal(toMapCoordinate('bad'), null);
  assert.equal(tagsTextFromImage(image), 'cat, snow');
  assert.equal(paletteTextFromImage(image), '#336699, #ffffff');
});
