import assert from 'node:assert/strict';
import { ref } from 'vue';
import { useImageLightboxDetails } from '../src/features/images/useImageLightboxDetails.ts';

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
  exif_taken_at: '2026-01-01T00:00:00.000Z',
  exif_camera: 'FUJIFILM X100V',
  exif_iso: 400,
  exif_aperture: 2.8,
  exif_shutter: '1/125',
  exif_focal_length: 23,
  tags_json: '["cat"," snow "]',
  dominant_color: 'Blue #336699',
  color_palette_json: '["#336699"," #ffffff "]',
  composition: 'Centered',
  ai_status: 'done',
  tg_status: 'done',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  is_public: 1,
  location_public: 1,
  folder_id: null,
};

test('image lightbox details centralizes links, exif rows and AI display values', () => {
  const state = useImageLightboxDetails({
    image: ref(image),
    origin: 'https://img.example.com',
    locationEditOpen: ref(false),
    editSearchRegion: ref('cn'),
    editForm: {
      title: '',
      caption: '',
      tags: '',
      dominant_color: '',
      palette: '',
      composition: '',
      location_name: '',
      location_lat: '',
      location_lng: '',
      location_region: null,
      is_public: 1,
      location_public: 1,
    },
  });

  assert.equal(state.publicPageUrl.value, 'https://img.example.com/p/images%2Fcat.webp');
  assert.equal(state.originalUrl.value, '/api/admin/original/images%2Fcat.webp');
  assert.equal(state.linkRows.value.length, 4);
  assert.deepEqual(state.aiTags.value, ['cat', 'snow']);
  assert.deepEqual(state.aiPalette.value, ['#336699', '#ffffff']);
  assert.equal(state.dominantColor.value.hex, '#336699');
  assert.equal(state.exifRows.value[0].label, '拍摄时间');
  assert.equal(state.exifRows.value[1].value, 'FUJIFILM X100V');
  assert.equal(state.hasCoordinates.value, true);
  assert.equal(state.mapLat.value, 48.8566);
  assert.equal(state.mapLng.value, 2.3522);
  assert.equal(state.mapRegion.value, 'global');
});

test('image lightbox details switches map display to editable coordinates while editing location', () => {
  const locationEditOpen = ref(true);
  const editSearchRegion = ref('global');
  const editForm = {
    title: '',
    caption: '',
    tags: '',
    dominant_color: '',
    palette: '',
    composition: '',
    location_name: '',
    location_lat: '35.6812',
    location_lng: '139.7671',
    location_region: null,
    is_public: 1,
    location_public: 1,
  };

  const state = useImageLightboxDetails({
    image: ref(image),
    origin: 'https://img.example.com',
    locationEditOpen,
    editSearchRegion,
    editForm,
  });

  assert.equal(state.mapLat.value, 35.6812);
  assert.equal(state.mapLng.value, 139.7671);
  assert.equal(state.mapRegion.value, 'global');

  locationEditOpen.value = false;

  assert.equal(state.mapLat.value, 48.8566);
  assert.equal(state.mapLng.value, 2.3522);
  assert.equal(state.mapRegion.value, 'global');
});
