import assert from 'node:assert/strict';
import { onRequestDelete, onRequestPatch } from '../functions/api/admin/image/[key].ts';

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const makeEnv = (row) => {
  const calls = {
    deletedObjects: [],
    selectedKeys: [],
    updates: [],
    deletes: [],
    telegram: [],
  };

  const env = {
    PUBLIC_BASE_URL: 'https://cdn.test',
    TG_BOT_TOKEN: 'token-test',
    BUCKET: {
      delete: async (key) => {
        calls.deletedObjects.push(key);
      },
    },
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            return {
              first: async () => {
                calls.selectedKeys.push(values[0]);
                return row;
              },
              run: async () => {
                if (/update\s+images/i.test(sql)) calls.updates.push({ sql, values });
                if (/delete\s+from\s+images/i.test(sql)) calls.deletes.push({ sql, values });
                return { success: true, meta: {} };
              },
            };
          },
        };
      },
    },
  };

  return { env, calls };
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

const imageRow = {
  key: 'img-key',
  title: '旧标题',
  caption: '旧描述',
  r2_key: 'img-key',
  original_filename: 'cat.jpg',
  width: 1200,
  height: 800,
  format: 'webp',
  bytes_compressed: 123456,
  location_name: '旧位置',
  location_lat: 31,
  location_lng: 121,
  exif_taken_at: '2025-08-26T02:08:37.000Z',
  exif_camera: 'Nikon Zf',
  exif_iso: 400,
  exif_aperture: 2.8,
  exif_shutter: '1/125',
  exif_focal_length: 40,
  tags_json: null,
  dominant_color: '深蓝色 #0F172A',
  color_palette_json: '["#0F172A","#F59E0B"]',
  composition: '中心构图',
  ai_status: 'pending',
  ai_error: null,
  ai_attempts: 0,
  ai_finished_at: null,
  tg_chat_id: '-100123',
  tg_message_id: 88,
};

await test('PATCH /api/admin/image/:key updates editable metadata and returns ImageRecord', async () => {
  const { env, calls } = makeEnv({
    ...imageRow,
    title: '新标题',
    caption: null,
    location_name: '上海',
    location_lat: 31.2304,
    location_lng: 121.4737,
  });

  const response = await onRequestPatch({
    env,
    params: { key: 'img-key' },
    request: new Request('http://x/api/admin/image/img-key', {
      method: 'PATCH',
      body: JSON.stringify({
        title: '新标题',
        caption: '',
        location_name: '上海',
        location_lat: 31.2304,
        location_lng: 121.4737,
        tags: '猫, 城市, 夜景',
        dominant_color: '暖橙色 #F59E0B',
        palette: '#F59E0B, #0F172A',
        composition: '三分法构图',
      }),
    }),
  });

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.title, '新标题');
  assert.equal(data.caption, null);
  assert.equal(data.location_name, '上海');
  assert.equal(data.location_lat, 31.2304);
  assert.equal(data.location_lng, 121.4737);
  assert.equal(data.bytes_compressed, 123456);
  assert.equal(data.original_filename, 'cat.jpg');
  assert.equal(data.exif_camera, 'Nikon Zf');
  assert.equal(data.exif_focal_length, 40);
  assert.equal(data.dominant_color, '深蓝色 #0F172A');
  assert.equal(data.color_palette_json, '["#0F172A","#F59E0B"]');
  assert.equal(data.composition, '中心构图');
  assert.equal('ai_proxy_url' in data, false);
  assert.equal('ai_model' in data, false);
  assert.equal(calls.updates.length, 1);
  assert.match(calls.updates[0].sql, /\btitle\b/i);
  assert.match(calls.updates[0].sql, /\blocation_lat\b/i);
  assert.match(calls.updates[0].sql, /\btags_json\b/i);
  assert.match(calls.updates[0].sql, /\bdominant_color\b/i);
  assert.match(calls.updates[0].sql, /\bcolor_palette_json\b/i);
  assert.match(calls.updates[0].sql, /\bcomposition\b/i);
  assert.deepEqual(calls.updates[0].values, [
    '新标题',
    null,
    '上海',
    31.2304,
    121.4737,
    '["猫","城市","夜景"]',
    '暖橙色 #F59E0B',
    '["#F59E0B","#0F172A"]',
    '三分法构图',
    null,
    null,
    'img-key',
  ]);
});

await test('PATCH /api/admin/image/:key rejects invalid coordinates before updating', async () => {
  const { env, calls } = makeEnv(imageRow);

  const response = await onRequestPatch({
    env,
    params: { key: 'img-key' },
    request: new Request('http://x/api/admin/image/img-key', {
      method: 'PATCH',
      body: JSON.stringify({
        title: '新标题',
        caption: '',
        location_name: '上海',
        location_lat: 120,
        location_lng: 121.4737,
        tags: '猫',
        dominant_color: '暖橙色 #F59E0B',
        palette: '#F59E0B',
        composition: '三分法构图',
      }),
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(calls.updates.length, 0);
});

await test('DELETE /api/admin/image/:key removes R2 object, tries Telegram cleanup, then deletes D1 row', async () => {
  const { env, calls } = makeEnv(imageRow);
  const telegramRequests = [];

  const response = await withMockedFetch(
    async (url, init) => {
      telegramRequests.push({ url: String(url), init });
      return Response.json({ ok: true, result: true });
    },
    () =>
      onRequestDelete({
        env,
        params: { key: 'img-key' },
        request: new Request('http://x/api/admin/image/img-key', { method: 'DELETE' }),
      }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, key: 'img-key' });
  assert.deepEqual(calls.deletedObjects, ['img-key']);
  assert.equal(telegramRequests.length, 1);
  assert.equal(telegramRequests[0].url, 'https://api.telegram.org/bottoken-test/deleteMessage');
  assert.equal(telegramRequests[0].init.body.get('chat_id'), '-100123');
  assert.equal(telegramRequests[0].init.body.get('message_id'), '88');
  assert.equal(calls.deletes.length, 1);
  assert.deepEqual(calls.deletes[0].values, ['img-key']);
});

await test('DELETE /api/admin/image/:key keeps deleting D1 when Telegram cleanup fails', async () => {
  const { env, calls } = makeEnv(imageRow);
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const response = await withMockedFetch(
      async () => Response.json({ ok: false, description: 'message to delete not found' }, { status: 400 }),
      () =>
        onRequestDelete({
          env,
          params: { key: 'img-key' },
          request: new Request('http://x/api/admin/image/img-key', { method: 'DELETE' }),
        }),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(calls.deletedObjects, ['img-key']);
    assert.equal(calls.deletes.length, 1);
  } finally {
    console.error = originalConsoleError;
  }
});

await test('DELETE /api/admin/image/:key returns 404 when image is missing', async () => {
  const { env, calls } = makeEnv(null);

  const response = await onRequestDelete({
    env,
    params: { key: 'missing' },
    request: new Request('http://x/api/admin/image/missing', { method: 'DELETE' }),
  });

  assert.equal(response.status, 404);
  assert.equal(calls.deletedObjects.length, 0);
  assert.equal(calls.deletes.length, 0);
});
