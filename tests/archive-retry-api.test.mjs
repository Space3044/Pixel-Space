import assert from 'node:assert/strict';
import { onRequestPost as retryArchivePost } from '../functions/api/admin/image/[key]/archive.ts';

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

const originalFile = () => new File(['original-bytes'], 'cat.jpg', { type: 'image/jpeg' });

const makeRequest = (file = originalFile()) => {
  const formData = new FormData();
  formData.set('original', file);
  return new Request('http://localhost/api/admin/image/images%2Fcat/archive', {
    method: 'POST',
    body: formData,
  });
};

const makeRow = async (overrides = {}) => ({
  key: 'images/cat',
  title: '猫猫',
  caption: '夜色',
  original_filename: 'cat.jpg',
  width: 1280,
  height: 853,
  format: 'webp',
  bytes_compressed: 10,
  location_name: '上海',
  location_lat: 31.2304,
  location_lng: 121.4737,
  location_region: 'china',
  exif_taken_at: null,
  exif_camera: 'Nikon Zf',
  exif_iso: 400,
  exif_aperture: 2.8,
  exif_shutter: '1/125',
  exif_focal_length: 40,
  tags_json: '["猫","夜景"]',
  dominant_color: '深蓝色 #0F172A',
  color_palette_json: '["#0F172A","#F59E0B"]',
  composition: '主体居中，暗色背景突出轮廓。',
  ai_status: 'done',
  tg_status: 'failed',
  hash: await sha256Hex(originalFile()),
  created_at: '2026-05-20 10:11:12',
  updated_at: '2026-05-20 10:11:12',
  is_public: 1,
  location_public: 1,
  folder_id: null,
  ...overrides,
});

const makeEnv = async (rowOverrides = {}) => {
  const calls = {
    events: [],
    updates: [],
    telegramRequests: [],
  };
  const row = await makeRow(rowOverrides);
  const env = {
    PUBLIC_BASE_URL: 'https://cdn.test',
    TG_BOT_TOKEN: 'token-test',
    TG_CHAT_ID: '-100123',
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            return {
              run: async () => {
                if (/update\s+images/i.test(sql)) {
                  calls.events.push('update');
                  calls.updates.push({ sql, values });
                  if (/tg_status\s*=\s*'pending'/i.test(sql)) row.tg_status = 'pending';
                  if (/tg_status\s*=\s*'done'/i.test(sql)) row.tg_status = 'done';
                  if (/tg_status\s*=\s*'failed'/i.test(sql)) row.tg_status = 'failed';
                }
                return { success: true, meta: {} };
              },
              first: async () => {
                calls.events.push('select');
                return values[0] === row.key ? row : null;
              },
            };
          },
        };
      },
    },
  };
  return { env, calls, row };
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

await test('POST /api/admin/image/:key/archive retries a failed Telegram archive with the original file', async () => {
  const { env, calls } = await makeEnv();
  const waitUntilTasks = [];

  const response = await withMockedFetch(telegramSuccessFetch(calls), () =>
    retryArchivePost({
      env,
      request: makeRequest(),
      params: { key: 'images%2Fcat' },
      waitUntil: (task) => waitUntilTasks.push(task),
    }),
  );

  assert.equal(response.status, 202);
  const data = await response.json();
  assert.equal(data.key, 'images/cat');
  assert.equal(data.tg_status, 'pending');
  assert.equal(waitUntilTasks.length, 1);
  assert.equal(calls.telegramRequests.length, 1);
  assert.equal(calls.telegramRequests[0].init.body.get('document').name, 'cat.jpg');
  assert.equal(calls.telegramRequests[0].init.body.get('caption'), 'imgbed:images/cat');

  await waitUntilTasks[0];
  assert.match(calls.updates.at(-1).sql, /tg_status\s*=\s*'done'/i);
});

await test('POST /api/admin/image/:key/archive rejects a different original file', async () => {
  const { env, calls } = await makeEnv();
  const response = await withMockedFetch(telegramSuccessFetch(calls), () =>
    retryArchivePost({
      env,
      request: makeRequest(new File(['other-bytes'], 'other.jpg', { type: 'image/jpeg' })),
      params: { key: 'images%2Fcat' },
      waitUntil: () => assert.fail('hash mismatch should not schedule archive'),
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(calls.telegramRequests, []);
  assert.equal(calls.updates.length, 0);
});

await test('POST /api/admin/image/:key/archive only retries failed archive records', async () => {
  const { env, calls } = await makeEnv({ tg_status: 'done' });
  const response = await withMockedFetch(telegramSuccessFetch(calls), () =>
    retryArchivePost({
      env,
      request: makeRequest(),
      params: { key: 'images%2Fcat' },
      waitUntil: () => assert.fail('done archive should not schedule retry'),
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(calls.telegramRequests, []);
  assert.equal(calls.updates.length, 0);
});
