import assert from 'node:assert/strict';
import { ref } from 'vue';
import {
  VIRTUAL_DOWNLOAD_GRANTS,
  VIRTUAL_HIDDEN_IMAGES,
  VIRTUAL_HIDDEN_LOCATIONS,
  isVirtualId,
  useLibraryDirectory,
} from '../src/features/library/useLibraryDirectory.ts';

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const folder = (id, parentId, name) => ({
  id,
  parent_id: parentId,
  name,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  image_count: 0,
  child_count: 0,
});

const image = (key, folderId, overrides = {}) => ({
  key,
  title: key,
  caption: null,
  original_filename: `${key}.jpg`,
  public_url: `/api/public/${key}`,
  width: 1200,
  height: 800,
  format: 'webp',
  bytes_compressed: 2048,
  location_name: null,
  location_lat: null,
  location_lng: null,
  location_region: null,
  exif_taken_at: null,
  exif_camera: null,
  exif_iso: null,
  exif_aperture: null,
  exif_shutter: null,
  exif_focal_length: null,
  tags_json: null,
  dominant_color: null,
  color_palette_json: null,
  composition: null,
  ai_status: 'done',
  tg_status: 'done',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  is_public: 1,
  location_public: 1,
  folder_id: folderId,
  ...overrides,
});

test('useLibraryDirectory builds folder maps breadcrumbs and move options', () => {
  const folders = ref([
    folder('travel', null, '旅行'),
    folder('film', null, '胶片'),
    folder('paris', 'travel', '巴黎'),
  ]);
  const images = ref([]);
  const downloadGrants = ref([]);
  const directory = useLibraryDirectory({ folders, images, downloadGrants });

  directory.currentFolderId.value = 'paris';

  assert.deepEqual(directory.subfolders.value, []);
  assert.deepEqual(directory.breadcrumb.value.map((crumb) => crumb.name), ['根目录', '旅行', '巴黎']);
  assert.deepEqual(directory.folderOptions.value.map((option) => option.label), ['胶片', '旅行', '旅行 / 巴黎']);
  assert.equal(directory.currentFolder.value?.name, '巴黎');
  assert.equal(directory.currentReadonly.value, false);
});

test('useLibraryDirectory filters real and virtual directories with sorted images', () => {
  const folders = ref([folder('travel', null, '旅行')]);
  const images = ref([
    image('old', 'travel', { created_at: '2026-01-01T00:00:00.000Z' }),
    image('new', 'travel', { created_at: '2026-02-01T00:00:00.000Z' }),
    image('private', null, { is_public: 0 }),
    image('hidden-location', null, { location_public: 0 }),
  ]);
  const downloadGrants = ref([{ id: 'grant-1' }]);
  const directory = useLibraryDirectory({ folders, images, downloadGrants });

  directory.currentFolderId.value = 'travel';

  assert.deepEqual(directory.currentImages.value.map((img) => img.key), ['new', 'old']);
  assert.equal(directory.virtualCounts.value[VIRTUAL_HIDDEN_IMAGES], 1);
  assert.equal(directory.virtualCounts.value[VIRTUAL_HIDDEN_LOCATIONS], 1);
  assert.equal(directory.virtualCounts.value[VIRTUAL_DOWNLOAD_GRANTS], 1);

  directory.currentFolderId.value = VIRTUAL_HIDDEN_IMAGES;

  assert.equal(directory.currentReadonly.value, true);
  assert.equal(directory.currentVirtual.value?.name, '未公开图片');
  assert.deepEqual(directory.currentImages.value.map((img) => img.key), ['private']);
  assert.deepEqual(directory.breadcrumb.value.map((crumb) => crumb.name), ['根目录', '未公开图片']);
  assert.equal(isVirtualId(VIRTUAL_HIDDEN_LOCATIONS), true);
  assert.equal(isVirtualId('travel'), false);
});
