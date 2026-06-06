import assert from 'node:assert/strict';
import { onRequestDelete, onRequestPatch } from '../functions/api/admin/image/[key].ts';
import { onRequestPost as batchDeletePost } from '../functions/api/admin/images/delete.ts';

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
    gets: [],
    puts: [],
    selectedKeys: [],
    updates: [],
    deletes: [],
    telegram: [],
  };

  const env = {
    PUBLIC_BASE_URL: 'https://cdn.test',
    TG_BOT_TOKEN: 'token-test',
    BUCKET: {
      get: async (key) => {
        calls.gets.push(key);
        return null;
      },
      put: async (key, body, options) => {
        calls.puts.push({ key, body, options });
      },
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

const pngResponse = () =>
  new Response(new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }), {
    headers: { 'content-type': 'image/png' },
  });

const imageRow = {
  key: 'img-key',
  title: '旧标题',
  caption: '旧描述',
  original_filename: 'cat.jpg',
  width: 1200,
  height: 800,
  format: 'webp',
  bytes_compressed: 123456,
  location_name: '旧位置',
  location_lat: 31,
  location_lng: 121,
  location_region: 'china',
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
  created_at: '2026-05-20 10:11:12',
  updated_at: '2026-05-21 12:13:14',
  is_public: 1,
  location_public: 1,
  folder_id: null,
  tg_chat_id: '-100123',
  tg_message_id: 88,
};

const makeBatchDeleteEnv = ({ r2Failures = new Set() } = {}) => {
  const rows = [
    { key: 'img_ok', tg_chat_id: null, tg_message_id: null },
    { key: 'img_fail', tg_chat_id: null, tg_message_id: null },
  ];
  const calls = {
    deletedObjects: [],
    d1DeleteValues: [],
  };

  const env = {
    TG_BOT_TOKEN: 'token-test',
    BUCKET: {
      delete: async (key) => {
        calls.deletedObjects.push(key);
        if (r2Failures.has(key)) throw new Error(`r2_delete_failed:${key}`);
      },
    },
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            return {
              all: async () => ({ results: rows.filter((row) => values.includes(row.key)) }),
              run: async () => {
                if (/delete\s+from\s+images/i.test(sql)) calls.d1DeleteValues.push(values);
                return { success: true, meta: { changes: values.length } };
              },
            };
          },
        };
      },
    },
  };

  return { env, calls };
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
    request: new Request('http://localhost/api/admin/image/img-key', {
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
  assert.equal(data.created_at, '2026-05-20T10:11:12.000Z');
  assert.equal(data.updated_at, '2026-05-21T12:13:14.000Z');
  assert.equal(data.is_public, 1);
  assert.equal(data.location_public, 1);
  assert.equal(data.folder_id, null);
  assert.equal(data.dominant_color, '深蓝色 #0F172A');
  assert.equal(data.color_palette_json, '["#0F172A","#F59E0B"]');
  assert.equal(data.composition, '中心构图');
  assert.equal('ai_proxy_url' in data, false);
  assert.equal('ai_model' in data, false);
  assert.equal('ai_error' in data, false);
  assert.equal('ai_attempts' in data, false);
  assert.equal('ai_finished_at' in data, false);
  assert.equal(calls.updates.length, 1);
  assert.match(calls.updates[0].sql, /\btitle\b/i);
  assert.match(calls.updates[0].sql, /\blocation_lat\b/i);
  assert.match(calls.updates[0].sql, /\blocation_region\b/i);
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
    null,
    '["猫","城市","夜景"]',
    '暖橙色 #F59E0B',
    '["#F59E0B","#0F172A"]',
    '三分法构图',
    null,
    null,
    'img-key',
  ]);
});

await test('PATCH /api/admin/image/:key pre-caches the updated location static map in R2', async () => {
  const { env, calls } = makeEnv({
    ...imageRow,
    title: '新标题',
    caption: null,
    location_name: '上海',
    location_lat: 31.2304,
    location_lng: 121.4737,
  });
  env.MAPBOX_PUBLIC_TOKEN = 'pk.mb-token';
  env.AMAP_WEB_KEY = 'amap-web-key';
  const staticMapRequests = [];

  const response = await withMockedFetch(
    async (url) => {
      staticMapRequests.push(String(url));
      return pngResponse();
    },
    () =>
      onRequestPatch({
        env,
        params: { key: 'img-key' },
        request: new Request('http://localhost/api/admin/image/img-key', {
          method: 'PATCH',
          body: JSON.stringify({
            title: '新标题',
            caption: '',
            location_name: '上海',
            location_lat: 31.2304,
            location_lng: 121.4737,
          }),
        }),
      }),
  );

  assert.equal(response.status, 200);
  assert.equal(staticMapRequests.length, 1);
  assert.equal(new URL(staticMapRequests[0]).origin, 'https://restapi.amap.com');
  const staticMapKey = 'staticmap/amap_31.230400_121.473700_z12_600x360.png';
  assert.equal(calls.gets.includes(staticMapKey), true);
  const staticMapPut = calls.puts.find((put) => put.key === staticMapKey);
  assert.ok(staticMapPut, 'updated location static map must be written to R2');
  assert.equal(staticMapPut.options.httpMetadata.contentType, 'image/png');
});

await test('PATCH /api/admin/image/:key does not pre-cache hidden visitor locations', async () => {
  const { env, calls } = makeEnv({
    ...imageRow,
    location_name: '隐藏位置',
    location_lat: 31.2304,
    location_lng: 121.4737,
    location_public: 0,
  });
  env.MAPBOX_PUBLIC_TOKEN = 'pk.mb-token';
  env.AMAP_WEB_KEY = 'amap-web-key';
  const staticMapRequests = [];

  const response = await withMockedFetch(
    async (url) => {
      staticMapRequests.push(String(url));
      return pngResponse();
    },
    () =>
      onRequestPatch({
        env,
        params: { key: 'img-key' },
        request: new Request('http://localhost/api/admin/image/img-key', {
          method: 'PATCH',
          body: JSON.stringify({
            title: '新标题',
            caption: '',
            location_name: '隐藏位置',
            location_lat: 31.2304,
            location_lng: 121.4737,
            location_public: 0,
          }),
        }),
      }),
  );

  assert.equal(response.status, 200);
  assert.equal(staticMapRequests.length, 0);
  assert.equal(calls.puts.some((put) => String(put.key).startsWith('staticmap/')), false);
});

await test('PATCH /api/admin/image/:key rejects invalid coordinates before updating', async () => {
  const { env, calls } = makeEnv(imageRow);

  const response = await onRequestPatch({
    env,
    params: { key: 'img-key' },
    request: new Request('http://localhost/api/admin/image/img-key', {
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
        request: new Request('http://localhost/api/admin/image/img-key', { method: 'DELETE' }),
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
          request: new Request('http://localhost/api/admin/image/img-key', { method: 'DELETE' }),
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
    request: new Request('http://localhost/api/admin/image/missing', { method: 'DELETE' }),
  });

  assert.equal(response.status, 404);
  assert.equal(calls.deletedObjects.length, 0);
  assert.equal(calls.deletes.length, 0);
});

await test('POST /api/admin/images/delete keeps D1 rows for images whose R2 delete fails', async () => {
  const { env, calls } = makeBatchDeleteEnv({ r2Failures: new Set(['img_fail']) });
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const response = await batchDeletePost({
      env,
      params: {},
      request: new Request('http://localhost/api/admin/images/delete', {
        method: 'POST',
        body: JSON.stringify({ keys: ['img_ok', 'img_fail', 'missing'] }),
      }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: false,
      deleted: 1,
      missing: ['missing'],
      failed: ['img_fail'],
    });
    assert.deepEqual(calls.deletedObjects, ['img_ok', 'img_fail']);
    assert.deepEqual(calls.d1DeleteValues, [['img_ok']]);
  } finally {
    console.error = originalConsoleError;
  }
});
