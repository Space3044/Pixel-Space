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
  'bytes_compressed',
  'caption',
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
  'public_url',
  'title',
  'width',
];

const sampleRow = {
  key: 'abc',
  title: 'Sample',
  caption: null,
  r2_key: 'abc.webp',
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
  assert.equal(data[0].exif_camera, 'Nikon Zf');
  assert.equal(data[0].exif_focal_length, 40);
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
  assert.deepEqual(calls.binds[0], ['%上海%', '%上海%', '%上海%']);
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
