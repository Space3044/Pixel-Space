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
  'caption',
  'format',
  'height',
  'key',
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
  location_name: null,
};

const makeEnv = (oneRow, manyRows) => ({
  PUBLIC_BASE_URL: 'https://cdn.test',
  DB: {
    prepare() {
      return {
        bind() {
          return {
            first: async () => oneRow,
          };
        },
        all: async () => ({ results: manyRows, success: true, meta: {} }),
        first: async () => oneRow,
      };
    },
  },
});

await test('GET /api/list returns ImageRecord[] with expected field set', async () => {
  const env = makeEnv(sampleRow, [sampleRow, sampleRow]);
  const res = await listGet({ env, params: {}, request: new Request('http://x/api/list') });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data));
  assert.equal(data.length, 2);
  assert.deepEqual(Object.keys(data[0]).sort(), EXPECTED_RECORD_KEYS);
  assert.equal(data[0].public_url, 'https://cdn.test/abc.webp');
});

await test('GET /api/list returns empty array when D1 has no rows', async () => {
  const env = makeEnv(null, []);
  const res = await listGet({ env, params: {}, request: new Request('http://x/api/list') });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(data, []);
});

await test('GET /api/image/:key returns single ImageRecord', async () => {
  const env = makeEnv(sampleRow, []);
  const res = await imageGet({
    env,
    params: { key: 'abc' },
    request: new Request('http://x/api/image/abc'),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(Object.keys(data).sort(), EXPECTED_RECORD_KEYS);
  assert.equal(data.public_url, 'https://cdn.test/abc.webp');
});

await test('GET /api/image/:key returns 404 when row missing', async () => {
  const env = makeEnv(null, []);
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
  const env = makeEnv(sampleRow, []);
  const res = await imageGet({
    env,
    params: { key: '' },
    request: new Request('http://x/api/image/'),
  });
  assert.equal(res.status, 404);
});
