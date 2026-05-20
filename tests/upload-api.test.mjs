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

const withMockedFetch = async (fetchImpl, fn) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

const withMutedConsoleError = async (fn) => {
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = originalConsoleError;
  }
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
    events: [],
    puts: [],
    insert: null,
    updates: [],
    selectedKey: null,
    telegramRequests: [],
  };

  const env = {
    PUBLIC_BASE_URL: 'https://cdn.test',
    TG_BOT_TOKEN: 'token-test',
    TG_CHAT_ID: '-100123',
    BUCKET: {
      put: async (key, body, options) => {
        calls.events.push('r2');
        calls.puts.push({ key, body, options });
      },
    },
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            return {
              run: async () => {
                if (/insert\s+into\s+images/i.test(sql)) {
                  calls.events.push('insert');
                  calls.insert = { sql, values };
                } else if (/update\s+images/i.test(sql)) {
                  calls.events.push('update');
                  calls.updates.push({ sql, values });
                }
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
                  bytes_compressed: inserted?.[7] ?? 0,
                  location_name: inserted?.[10] ?? null,
                  location_lat: inserted?.[11] ?? null,
                  location_lng: inserted?.[12] ?? null,
                  exif_taken_at: inserted?.[13] ?? null,
                  exif_camera: inserted?.[14] ?? null,
                  exif_iso: inserted?.[15] ?? null,
                  exif_aperture: inserted?.[16] ?? null,
                  exif_shutter: inserted?.[17] ?? null,
                  exif_focal_length: inserted?.[18] ?? null,
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

const telegramSuccessFetch = (calls) => async (url, init) => {
  calls.events.push('telegram');
  calls.telegramRequests.push({ url: String(url), init });
  return Response.json({
    ok: true,
    result: {
      message_id: 77,
      chat: { id: -100123 },
      document: { file_id: 'telegram-file-id' },
    },
  });
};

await test('POST /api/upload stores compressed WebP in R2, writes D1 metadata, and returns ImageRecord', async () => {
  const { env, calls } = makeEnv();
  const request = makeUploadRequest();
  const compressed = await request.clone().formData().then((data) => data.get('compressed'));
  const expectedHash = await sha256Hex(compressed);

  const response = await withMockedFetch(telegramSuccessFetch(calls), () =>
    uploadPost({ env, request, params: {} }),
  );

  assert.equal(response.status, 201);
  const data = await response.json();
  assert.deepEqual(Object.keys(data).sort(), [
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
  ]);
  assert.equal(data.title, '猫猫');
  assert.equal(data.width, 1280);
  assert.equal(data.height, 853);
  assert.equal(data.format, 'webp');
  assert.equal(data.bytes_compressed, 10);
  assert.equal(data.public_url, `https://cdn.test/${data.key}`);
  assert.equal(data.exif_camera, 'Nikon Zf');
  assert.equal(data.exif_focal_length, 40);

  assert.equal(calls.puts.length, 1);
  assert.equal(calls.puts[0].key, data.key);
  assert.equal(calls.puts[0].options.httpMetadata.contentType, 'image/webp');

  assert.match(calls.insert.sql, /INSERT INTO images/i);
  assert.match(calls.insert.sql, /\bexif_focal_length\b/i);
  assert.match(calls.insert.sql, /\btg_status\b/i);
  assert.equal(calls.insert.values[0], data.key);
  assert.equal(calls.insert.values[3], data.key);
  assert.equal(calls.insert.values[4], 1280);
  assert.equal(calls.insert.values[5], 853);
  assert.equal(calls.insert.values[6], 'webp');
  assert.equal(calls.insert.values[8], 14);
  assert.equal(calls.insert.values[9], expectedHash);
  assert.equal(calls.insert.values[18], 40);
  assert.equal(calls.insert.values[19], 'pending');
  assert.equal(calls.selectedKey, data.key);
});

await test('POST /api/upload archives the original file to Telegram after D1 insert', async () => {
  const { env, calls } = makeEnv();
  const request = makeUploadRequest();

  const response = await withMockedFetch(telegramSuccessFetch(calls), () =>
    uploadPost({ env, request, params: {} }),
  );

  assert.equal(response.status, 201);
  const data = await response.json();
  assert.deepEqual(calls.events, ['r2', 'insert', 'telegram', 'update']);
  assert.equal(calls.telegramRequests.length, 1);
  assert.equal(calls.telegramRequests[0].url, 'https://api.telegram.org/bottoken-test/sendDocument');
  assert.equal(calls.telegramRequests[0].init.method, 'POST');
  assert.equal(calls.telegramRequests[0].init.body.get('chat_id'), '-100123');
  assert.equal(calls.telegramRequests[0].init.body.get('caption'), `imgbed:${data.key}`);
  assert.equal(calls.telegramRequests[0].init.body.get('document').name, 'cat.jpg');

  assert.equal(calls.updates.length, 1);
  assert.match(calls.updates[0].sql, /\btg_file_id\b/i);
  assert.match(calls.updates[0].sql, /\btg_message_id\b/i);
  assert.match(calls.updates[0].sql, /\btg_chat_id\b/i);
  assert.match(calls.updates[0].sql, /tg_status\s*=\s*'done'/i);
  assert.deepEqual(calls.updates[0].values, ['telegram-file-id', 77, '-100123', data.key]);
});

await test('POST /api/upload marks Telegram archive failure without blocking upload', async () => {
  const { env, calls } = makeEnv();
  const request = makeUploadRequest();

  const response = await withMutedConsoleError(() =>
    withMockedFetch(
      async () =>
        Response.json(
          {
            ok: false,
            description: 'chat not found',
          },
          { status: 400 },
        ),
      () => uploadPost({ env, request, params: {} }),
    ),
  );

  assert.equal(response.status, 201);
  const data = await response.json();
  assert.equal(calls.updates.length, 1);
  assert.match(calls.updates[0].sql, /tg_status\s*=\s*'failed'/i);
  assert.match(calls.updates[0].sql, /\btg_error\b/i);
  assert.match(calls.updates[0].values[0], /chat not found/);
  assert.equal(calls.updates[0].values[1], data.key);
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
