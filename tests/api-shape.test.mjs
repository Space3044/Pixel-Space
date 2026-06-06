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
  'ai_status',
  'bytes_compressed',
  'caption',
  'color_palette_json',
  'composition',
  'created_at',
  'dominant_color',
  'exif_aperture',
  'exif_camera',
  'exif_focal_length',
  'exif_iso',
  'exif_shutter',
  'exif_taken_at',
  'folder_id',
  'format',
  'height',
  'is_public',
  'key',
  'location_lat',
  'location_lng',
  'location_name',
  'location_public',
  'original_filename',
  'public_url',
  'tags_json',
  'title',
  'updated_at',
  'width',
];

const sampleRow = {
  key: 'abc',
  title: 'Sample',
  caption: null,
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
  created_at: '2026-05-20 10:11:12',
  updated_at: '2026-05-21 12:13:14',
  is_public: 1,
  location_public: 1,
  folder_id: null,
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
  assert.equal(data[0].public_url, 'https://cdn.test/abc');
  assert.equal(data[0].location_name, '上海');
  assert.equal(data[0].location_lat, 31.2304);
  assert.equal(data[0].location_lng, 121.4737);
  assert.equal(data[0].bytes_compressed, 123456);
  assert.equal(data[0].original_filename, 'DSC_7983.NEF');
  assert.equal(data[0].exif_camera, 'Nikon Zf');
  assert.equal(data[0].exif_focal_length, 40);
  assert.equal(data[0].ai_status, 'pending');
  assert.equal(data[0].created_at, '2026-05-20T10:11:12.000Z');
  assert.equal(data[0].updated_at, '2026-05-21T12:13:14.000Z');
  assert.equal(data[0].is_public, 1);
  assert.equal(data[0].location_public, 1);
  assert.equal(data[0].folder_id, null);
  assert.equal('ai_proxy_url' in data[0], false);
  assert.equal('ai_model' in data[0], false);
  assert.equal('ai_error' in data[0], false);
  assert.equal('ai_attempts' in data[0], false);
  assert.equal('ai_finished_at' in data[0], false);
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

await test('GET /api/list searches title caption original filename and location by q parameter', async () => {
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
  assert.match(calls.prepared[0], /\boriginal_filename\b/i);
  assert.match(calls.prepared[0], /\blocation_name\b/i);
  assert.match(calls.prepared[0], /\bsearch_content\b/i);
  assert.match(calls.prepared[0], /\bdominant_color\b/i);
  assert.match(calls.prepared[0], /\bcomposition\b/i);
  assert.deepEqual(calls.binds[0], ['%上海%', '%上海%', '%上海%', '%上海%', '%上海%', '%上海%', '%上海%']);
});

await test('GET /api/list supports opt-in cursor pagination without changing legacy array shape', async () => {
  const rows = [
    { ...sampleRow, key: 'img-3', created_at: '2026-05-22 10:11:12' },
    { ...sampleRow, key: 'img-2', created_at: '2026-05-21 10:11:12' },
    { ...sampleRow, key: 'img-1', created_at: '2026-05-20 10:11:12' },
  ];
  const { env, calls } = makeEnv(sampleRow, rows);
  const res = await listGet({
    env,
    params: {},
    request: new Request('http://x/api/list?limit=2'),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(Object.keys(data).sort(), ['items', 'nextCursor']);
  assert.equal(data.items.length, 2);
  assert.equal(data.items[0].key, 'img-3');
  assert.equal(data.items[1].key, 'img-2');
  assert.equal(typeof data.nextCursor, 'string');
  assert.match(calls.prepared[0], /ORDER BY created_at DESC,\s*key DESC\s+LIMIT \?/i);
  assert.deepEqual(calls.binds[0], [3]);
});

await test('GET /api/list cursor pagination adds a keyset condition after existing filters', async () => {
  const cursor = encodeURIComponent(JSON.stringify(['2026-05-21 10:11:12', 'img-2']));
  const { env, calls } = makeEnv(sampleRow, [sampleRow]);
  const res = await listGet({
    env,
    params: {},
    request: new Request(`http://x/api/list?q=cat&limit=2&cursor=${cursor}`),
  });

  assert.equal(res.status, 200);
  assert.match(calls.prepared[0], /\(created_at < \? OR \(created_at = \? AND key < \?\)\)/i);
  assert.deepEqual(calls.binds[0], [
    '%cat%',
    '%cat%',
    '%cat%',
    '%cat%',
    '%cat%',
    '%cat%',
    '%cat%',
    '2026-05-21 10:11:12',
    '2026-05-21 10:11:12',
    'img-2',
    3,
  ]);
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
  assert.equal(data.public_url, 'https://cdn.test/abc');
  assert.equal(data.location_lat, 31.2304);
  assert.equal(data.location_lng, 121.4737);
  assert.equal(data.bytes_compressed, 123456);
  assert.equal(data.original_filename, 'DSC_7983.NEF');
  assert.equal(data.exif_taken_at, '2025-08-26T02:08:37.000Z');
  assert.equal(data.exif_iso, 400);
  assert.equal(data.created_at, '2026-05-20T10:11:12.000Z');
  assert.equal(data.updated_at, '2026-05-21T12:13:14.000Z');
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
