import assert from 'node:assert/strict';
import { onRequestPost as uploadPost } from '../functions/api/upload.ts';

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const sha256Hex = async (file) => {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const makeUploadRequest = (overrides = {}) => {
  const formData = new FormData();
  formData.append(
    'original',
    overrides.original ?? new File(['original-bytes'], 'cat.jpg', { type: 'image/jpeg' }),
  );
  formData.append(
    'compressed',
    overrides.compressed ?? new File(['webp-bytes'], 'cat.webp', { type: 'image/webp' }),
  );
  formData.append(
    'exif',
    JSON.stringify({
      taken_at: '2025-08-26T02:08:37.000Z',
      camera: 'Nikon Zf',
      iso: 400,
      aperture: 2.8,
      shutter: '1/125',
      focal_length: 40,
      location_lat: 31.2304,
      location_lng: 121.4737,
      ...(overrides.exif ?? {}),
    }),
  );
  formData.append(
    'meta',
    JSON.stringify({
      title: '猫猫',
      caption: '夜色',
      location_name: '上海',
      location_lat: 31.2304,
      location_lng: 121.4737,
      ...(overrides.meta ?? {}),
    }),
  );
  formData.append('dimensions', JSON.stringify(overrides.dimensions ?? { width: 1280, height: 853 }));
  return new Request('http://x/api/upload', { method: 'POST', body: formData });
};

const makeEnv = () => {
  const calls = {
    puts: [],
    insert: null,
    selectedKey: null,
  };

  const env = {
    PUBLIC_BASE_URL: 'https://cdn.test',
    BUCKET: {
      put: async (key, body, options) => {
        calls.puts.push({ key, body, options });
      },
    },
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            return {
              run: async () => {
                calls.insert = { sql, values };
                return { success: true, meta: {} };
              },
              first: async () => {
                calls.selectedKey = values[0];
                const inserted = calls.insert?.values;
                return {
                  key: values[0],
                  title: inserted?.[1] ?? '',
                  caption: inserted?.[2] ?? null,
                  r2_key: inserted?.[3] ?? values[0],
                  width: inserted?.[4] ?? 0,
                  height: inserted?.[5] ?? 0,
                  format: inserted?.[6] ?? 'webp',
                  location_name: inserted?.[10] ?? null,
                };
              },
            };
          },
        };
      },
    },
  };

  return { env, calls };
};

await test('POST /api/upload stores compressed WebP in R2, writes D1 metadata, and returns ImageRecord', async () => {
  const { env, calls } = makeEnv();
  const request = makeUploadRequest();
  const compressed = await request.clone().formData().then((data) => data.get('compressed'));
  const expectedHash = await sha256Hex(compressed);

  const response = await uploadPost({ env, request, params: {} });

  assert.equal(response.status, 201);
  const data = await response.json();
  assert.deepEqual(Object.keys(data).sort(), [
    'caption',
    'format',
    'height',
    'key',
    'location_name',
    'public_url',
    'title',
    'width',
  ]);
  assert.equal(data.title, '猫猫');
  assert.equal(data.width, 1280);
  assert.equal(data.height, 853);
  assert.equal(data.format, 'webp');
  assert.equal(data.public_url, `https://cdn.test/${data.key}`);

  assert.equal(calls.puts.length, 1);
  assert.equal(calls.puts[0].key, data.key);
  assert.equal(calls.puts[0].options.httpMetadata.contentType, 'image/webp');

  assert.match(calls.insert.sql, /INSERT INTO images/i);
  assert.match(calls.insert.sql, /\bexif_focal_length\b/i);
  assert.equal(calls.insert.values[0], data.key);
  assert.equal(calls.insert.values[3], data.key);
  assert.equal(calls.insert.values[4], 1280);
  assert.equal(calls.insert.values[5], 853);
  assert.equal(calls.insert.values[6], 'webp');
  assert.equal(calls.insert.values[8], 14);
  assert.equal(calls.insert.values[9], expectedHash);
  assert.equal(calls.insert.values[18], 40);
  assert.equal(calls.selectedKey, data.key);
});

await test('POST /api/upload rejects non-image input before R2 or D1 writes', async () => {
  const { env, calls } = makeEnv();
  const request = makeUploadRequest({
    original: new File(['not-image'], 'notes.txt', { type: 'text/plain' }),
  });

  const response = await uploadPost({ env, request, params: {} });

  assert.equal(response.status, 400);
  assert.equal(calls.puts.length, 0);
  assert.equal(calls.insert, null);
});
