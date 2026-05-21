import assert from 'node:assert/strict';
import { onRequestGet as listGet } from '../functions/api/list.ts';
import { onRequestGet as imageGet } from '../functions/api/image/[key].ts';

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const EXPECTED_RECORD_KEYS = [
  'ai_attempts',
  'ai_error',
  'ai_finished_at',
  'ai_status',
  'bytes_compressed',
  'caption',
  'color_palette_json',
  'composition',
  'dominant_color',
  'exif_aperture',
  'exif_camera',
  'exif_focal_length',
  'exif_iso',
  'exif_shutter',
  'exif_taken_at',
  'format',
  'height',
  'key',
  'location_lat',
  'location_lng',
  'location_name',
  'original_filename',
  'public_url',
  'tags_json',
  'title',
  'width',
];

const sampleRow = {
  key: 'abc',
  title: 'Sample',
  caption: null,
  r2_key: 'abc.webp',
  original_filename: 'DSC_7983.NEF',
  width: 1024,
  height: 768,
  format: 'webp',
  bytes_compressed: 123456,
  location_name: '上海',
  location_lat: 31.2304,
  location_lng: 121.4737,
  exif_taken_at: '2025-08-26T02:08:37.000Z',
  exif_camera: 'Nikon Zf',
  exif_iso: 400,
  exif_aperture: 2.8,
  exif_shutter: '1/125',
  exif_focal_length: 40,
  tags_json: null,
  dominant_color: '暖橙色 #F59E0B',
  color_palette_json: '["#F59E0B","#0F172A"]',
  composition: '中心构图',
  search_content: null,
  ai_status: 'pending',
  ai_error: null,
  ai_attempts: 0,
  ai_finished_at: null,
};

const makeEnv = (oneRow, manyRows) => {
  const calls = {
    prepared: [],
    binds: [],
  };

  const env = {
    PUBLIC_BASE_URL: 'https://cdn.test',
    DB: {
      prepare(sql) {
        calls.prepared.push(sql);
        return {
          bind(...values) {
            calls.binds.push(values);
            return {
              first: async () => oneRow,
              all: async () => ({ results: manyRows, success: true, meta: {} }),
            };
          },
          all: async () => ({ results: manyRows, success: true, meta: {} }),
          first: async () => oneRow,
        };
      },
    },
  };

  return { env, calls };
};

await test('GET /api/list returns ImageRecord[] with expected field set', async () => {
  const { env } = makeEnv(sampleRow, [sampleRow, sampleRow]);
  const res = await listGet({ env, params: {}, request: new Request('http://x/api/list') });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data));
  assert.equal(data.length, 2);
  assert.deepEqual(Object.keys(data[0]).sort(), EXPECTED_RECORD_KEYS);
  assert.equal(data[0].public_url, 'https://cdn.test/abc.webp');
  assert.equal(data[0].location_name, '上海');
  assert.equal(data[0].location_lat, 31.2304);
  assert.equal(data[0].location_lng, 121.4737);
  assert.equal(data[0].bytes_compressed, 123456);
  assert.equal(data[0].original_filename, 'DSC_7983.NEF');
  assert.equal(data[0].exif_camera, 'Nikon Zf');
  assert.equal(data[0].exif_focal_length, 40);
  assert.equal(data[0].ai_status, 'pending');
  assert.equal('ai_proxy_url' in data[0], false);
  assert.equal('ai_model' in data[0], false);
  assert.equal(data[0].tags_json, null);
  assert.equal(data[0].dominant_color, '暖橙色 #F59E0B');
  assert.equal(data[0].color_palette_json, '["#F59E0B","#0F172A"]');
  assert.equal(data[0].composition, '中心构图');
  assert.equal('ocr_text' in data[0], false);
});

await test('GET /api/list returns empty array when D1 has no rows', async () => {
  const { env } = makeEnv(null, []);
  const res = await listGet({ env, params: {}, request: new Request('http://x/api/list') });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data, []);
});

await test('GET /api/list searches title caption and location by q parameter', async () => {
  const { env, calls } = makeEnv(sampleRow, [sampleRow]);
  const res = await listGet({
    env,
    params: {},
    request: new Request('http://x/api/list?q=%E4%B8%8A%E6%B5%B7'),
  });

  assert.equal(res.status, 200);
  assert.match(calls.prepared[0], /WHERE/i);
  assert.match(calls.prepared[0], /\btitle\b/i);
  assert.match(calls.prepared[0], /\bcaption\b/i);
  assert.match(calls.prepared[0], /\blocation_name\b/i);
  assert.match(calls.prepared[0], /\bsearch_content\b/i);
  assert.match(calls.prepared[0], /\bdominant_color\b/i);
  assert.match(calls.prepared[0], /\bcomposition\b/i);
  assert.deepEqual(calls.binds[0], ['%上海%', '%上海%', '%上海%', '%上海%', '%上海%', '%上海%']);
});

await test('GET /api/image/:key returns single ImageRecord', async () => {
  const { env } = makeEnv(sampleRow, []);
  const res = await imageGet({
    env,
    params: { key: 'abc' },
    request: new Request('http://x/api/image/abc'),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(Object.keys(data).sort(), EXPECTED_RECORD_KEYS);
  assert.equal(data.public_url, 'https://cdn.test/abc.webp');
  assert.equal(data.location_lat, 31.2304);
  assert.equal(data.location_lng, 121.4737);
  assert.equal(data.bytes_compressed, 123456);
  assert.equal(data.original_filename, 'DSC_7983.NEF');
  assert.equal(data.exif_taken_at, '2025-08-26T02:08:37.000Z');
  assert.equal(data.exif_iso, 400);
});

await test('GET /api/image/:key returns 404 when row missing', async () => {
  const { env } = makeEnv(null, []);
  const res = await imageGet({
    env,
    params: { key: 'missing' },
    request: new Request('http://x/api/image/missing'),
  });
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.deepEqual(Object.keys(data), ['error']);
});

await test('GET /api/image/:key returns 404 for empty key param', async () => {
  const { env } = makeEnv(sampleRow, []);
  const res = await imageGet({
    env,
    params: { key: '' },
    request: new Request('http://x/api/image/'),
  });
  assert.equal(res.status, 404);
});
