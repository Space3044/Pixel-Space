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

const pngResponse = () =>
  new Response(new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }), {
    headers: { 'content-type': 'image/png' },
  });

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
      location_region: 'china',
      tags: '猫, 夜景',
      search_content: '猫 夜景 HELLO',
      dominant_color: '深蓝色 #0F172A',
      palette: '#0F172A, #F59E0B',
      composition: '主体居中，暗色背景突出轮廓。',
      ai_status: 'done',
      ...(overrides.meta ?? {}),
    }),
  );
  formData.append('dimensions', JSON.stringify(overrides.dimensions ?? { width: 1280, height: 853 }));
  return new Request('http://localhost/api/upload', { method: 'POST', body: formData });
};

const makeEnv = (options = {}) => {
  const calls = {
    events: [],
    gets: [],
    puts: [],
    deletedObjects: [],
    insert: null,
    updates: [],
    selectedKey: null,
    telegramRequests: [],
  };

  const env = {
    PUBLIC_BASE_URL: 'https://cdn.test',
    TG_BOT_TOKEN: 'token-test',
    TG_CHAT_ID: '-100123',
    PROXY_KEY: 'proxy-key-test',
    MAPBOX_PUBLIC_TOKEN: options.mapboxToken,
    AMAP_WEB_KEY: options.amapWebKey,
    BUCKET: {
      get: async (key) => {
        calls.gets.push(key);
        return options.cachedObjects?.get(key) ?? null;
      },
      put: async (key, body, options) => {
        calls.events.push('r2');
        calls.puts.push({ key, body, options });
      },
      delete: async (key) => {
        calls.events.push('r2-delete');
        calls.deletedObjects.push(key);
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
                  if (options.failImageInsert) throw new Error('d1_insert_failed');
                } else if (/update\s+images/i.test(sql)) {
                  calls.events.push('update');
                  calls.updates.push({ sql, values });
                }
                return { success: true, meta: {} };
              },
              first: async () => {
                if (/where\s+hash\s*=/i.test(sql)) return options.existingRow ?? null;
                calls.selectedKey = values[0];
                const inserted = calls.insert?.values;
                return {
                  key: values[0],
                  title: inserted?.[1] ?? '',
                  caption: inserted?.[2] ?? null,
                  original_filename: inserted?.[3] ?? '',
                  width: inserted?.[4] ?? 0,
                  height: inserted?.[5] ?? 0,
                  format: inserted?.[6] ?? 'webp',
                  bytes_compressed: inserted?.[7] ?? 0,
                  location_name: inserted?.[9] ?? null,
                  location_lat: inserted?.[10] ?? null,
                  location_lng: inserted?.[11] ?? null,
                  location_region: inserted?.[12] ?? null,
                  exif_taken_at: inserted?.[13] ?? null,
                  exif_camera: inserted?.[14] ?? null,
                  exif_iso: inserted?.[15] ?? null,
                  exif_aperture: inserted?.[16] ?? null,
                  exif_shutter: inserted?.[17] ?? null,
                  exif_focal_length: inserted?.[18] ?? null,
                  tags_json: inserted?.[19] ?? null,
                  dominant_color: inserted?.[21] ?? null,
                  color_palette_json: inserted?.[22] ?? null,
                  composition: inserted?.[23] ?? null,
                  ai_status: inserted?.[24] ?? 'pending',
                  tg_status: inserted?.[25] ?? 'pending',
                  created_at: '2026-05-20 10:11:12',
                  updated_at: '2026-05-20 10:11:12',
                  is_public: inserted?.[26] ?? 1,
                  location_public: inserted?.[27] ?? 1,
                  folder_id: inserted?.[28] ?? null,
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
  const original = await request.clone().formData().then((data) => data.get('original'));
  const expectedHash = await sha256Hex(original);

  const response = await withMockedFetch(telegramSuccessFetch(calls), () =>
    uploadPost({ env, request, params: {} }),
  );

  assert.equal(response.status, 201);
  const data = await response.json();
  assert.deepEqual(Object.keys(data).sort(), [
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
    'location_region',
    'original_filename',
    'public_url',
    'tags_json',
    'tg_status',
    'title',
    'updated_at',
    'width',
  ]);
  assert.equal(data.title, '猫猫');
  assert.match(data.key, /^images\/[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$/);
  assert.equal(data.width, 1280);
  assert.equal(data.height, 853);
  assert.equal(data.format, 'webp');
  assert.equal(data.bytes_compressed, 10);
  assert.equal(data.original_filename, 'cat.jpg');
  assert.equal(data.public_url, `https://cdn.test/${data.key}`);
  assert.equal(data.exif_camera, 'Nikon Zf');
  assert.equal(data.exif_focal_length, 40);
  assert.equal(data.ai_status, 'done');
  assert.equal(data.tg_status, 'pending');
  assert.equal(data.created_at, '2026-05-20T10:11:12.000Z');
  assert.equal(data.updated_at, '2026-05-20T10:11:12.000Z');
  assert.equal(data.is_public, 1);
  assert.equal(data.location_public, 1);
  assert.equal(data.folder_id, null);
  assert.equal(data.dominant_color, '深蓝色 #0F172A');
  assert.equal(data.color_palette_json, '["#0F172A","#F59E0B"]');
  assert.equal(data.composition, '主体居中，暗色背景突出轮廓。');
  assert.equal('ai_proxy_url' in data, false);
  assert.equal('ai_model' in data, false);
  assert.equal('ocr_text' in data, false);
  assert.equal(data.tags_json, '["猫","夜景"]');
  assert.equal(data.location_region, 'china');

  assert.equal(calls.puts.length, 1);
  assert.equal(calls.puts[0].key, data.key);
  assert.equal(calls.puts[0].options.httpMetadata.contentType, 'image/webp');

  assert.match(calls.insert.sql, /INSERT INTO images/i);
  assert.match(calls.insert.sql, /\bexif_focal_length\b/i);
  assert.match(calls.insert.sql, /\btg_status\b/i);
  assert.match(calls.insert.sql, /\bai_status\b/i);
  assert.match(calls.insert.sql, /\btags_json\b/i);
  assert.match(calls.insert.sql, /\bsearch_content\b/i);
  assert.match(calls.insert.sql, /\bdominant_color\b/i);
  assert.match(calls.insert.sql, /\bcolor_palette_json\b/i);
  assert.match(calls.insert.sql, /\bcomposition\b/i);
  assert.match(calls.insert.sql, /\boriginal_filename\b/i);
  assert.doesNotMatch(calls.insert.sql, /\br2_key\b/i);
  assert.doesNotMatch(calls.insert.sql, /\bbytes_original\b/i);
  assert.doesNotMatch(calls.insert.sql, /\bai_error\b|\bai_attempts\b|\bai_finished_at\b/i);
  assert.doesNotMatch(calls.insert.sql, /\bocr_text\b/i);
  assert.doesNotMatch(calls.insert.sql, /\bai_proxy_url\b|\bai_model\b/i);
  assert.equal(calls.insert.values[0], data.key);
  assert.equal(calls.insert.values[3], 'cat.jpg');
  assert.equal(calls.insert.values[4], 1280);
  assert.equal(calls.insert.values[5], 853);
  assert.equal(calls.insert.values[6], 'webp');
  assert.equal(calls.insert.values[8], expectedHash);
  assert.equal(calls.insert.values[12], 'china');
  assert.equal(calls.insert.values[18], 40);
  assert.equal(calls.insert.values[19], '["猫","夜景"]');
  assert.equal(calls.insert.values[20], '猫 夜景 HELLO');
  assert.equal(calls.insert.values[21], '深蓝色 #0F172A');
  assert.equal(calls.insert.values[22], '["#0F172A","#F59E0B"]');
  assert.equal(calls.insert.values[23], '主体居中，暗色背景突出轮廓。');
  assert.equal(calls.insert.values[24], 'done');
  assert.equal(calls.insert.values[25], 'pending');
  assert.equal(calls.selectedKey, data.key);
});

await test('POST /api/upload pre-caches the stored location static map in R2', async () => {
  const { env, calls } = makeEnv({ amapWebKey: 'amap-web-key', mapboxToken: 'pk.mb-token' });
  const request = makeUploadRequest();
  const staticMapRequests = [];

  const response = await withMockedFetch(async (url, init) => {
    const requestUrl = String(url);
    if (requestUrl.startsWith('https://restapi.amap.com/') || requestUrl.startsWith('https://api.mapbox.com/')) {
      staticMapRequests.push(requestUrl);
      return pngResponse();
    }
    return telegramSuccessFetch(calls)(url, init);
  }, () => uploadPost({ env, request, params: {} }));

  assert.equal(response.status, 201);
  assert.equal(staticMapRequests.length, 1);
  assert.equal(new URL(staticMapRequests[0]).origin, 'https://restapi.amap.com');
  const staticMapKey = 'staticmap/amap_31.230400_121.473700_z12_600x360.png';
  assert.equal(calls.gets.includes(staticMapKey), true);
  const staticMapPut = calls.puts.find((put) => put.key === staticMapKey);
  assert.ok(staticMapPut, 'static map must be written to R2 during upload');
  assert.equal(staticMapPut.options.httpMetadata.contentType, 'image/png');
});

await test('POST /api/upload does not pre-cache hidden visitor locations', async () => {
  const { env, calls } = makeEnv({ mapboxToken: 'pk.mb-token' });
  const request = makeUploadRequest({ meta: { location_public: 0 } });
  const staticMapRequests = [];

  const response = await withMockedFetch(async (url, init) => {
    const requestUrl = String(url);
    if (requestUrl.startsWith('https://restapi.amap.com/') || requestUrl.startsWith('https://api.mapbox.com/')) {
      staticMapRequests.push(requestUrl);
      return pngResponse();
    }
    return telegramSuccessFetch(calls)(url, init);
  }, () => uploadPost({ env, request, params: {} }));

  assert.equal(response.status, 201);
  assert.equal(staticMapRequests.length, 0);
  assert.equal(calls.puts.some((put) => String(put.key).startsWith('staticmap/')), false);
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

await test('POST /api/upload schedules Telegram archive without delaying the upload response', async () => {
  const { env, calls } = makeEnv();
  const request = makeUploadRequest();
  const waitUntilTasks = [];
  let releaseTelegram;
  const telegramGate = new Promise((resolve) => {
    releaseTelegram = resolve;
  });

  const responsePromise = withMockedFetch(
    async (url, init) => {
      calls.events.push('telegram');
      calls.telegramRequests.push({ url: String(url), init });
      await telegramGate;
      return Response.json({
        ok: true,
        result: {
          message_id: 77,
          chat: { id: -100123 },
          document: { file_id: 'telegram-file-id' },
        },
      });
    },
    () =>
      uploadPost({
        env,
        request,
        params: {},
        waitUntil: (task) => waitUntilTasks.push(task),
      }),
  );

  const earlyResult = await Promise.race([
    responsePromise,
    new Promise((resolve) => setTimeout(() => resolve('timed_out'), 20)),
  ]);

  if (earlyResult === 'timed_out') {
    releaseTelegram();
    await responsePromise.catch(() => {});
    assert.fail('upload response waited for Telegram archive');
  }

  assert.equal(earlyResult.status, 201);
  assert.equal(waitUntilTasks.length, 1);
  assert.deepEqual(calls.events, ['r2', 'insert', 'telegram']);
  assert.equal(calls.updates.length, 0);

  releaseTelegram();
  await waitUntilTasks[0];
  assert.equal(calls.updates.length, 1);
  assert.match(calls.updates[0].sql, /tg_status\s*=\s*'done'/i);
});

await test('POST /api/upload does not infer location_region from coordinate bounds', async () => {
  const { env, calls } = makeEnv();
  const request = makeUploadRequest({ meta: { location_region: undefined } });

  const response = await withMockedFetch(telegramSuccessFetch(calls), () =>
    uploadPost({ env, request, params: {} }),
  );

  assert.equal(response.status, 201);
  const data = await response.json();
  assert.equal(data.location_region, null);
  assert.equal(calls.insert.values[12], null);
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

await test('POST /api/upload deletes the R2 object when D1 insert fails after upload', async () => {
  const { env, calls } = makeEnv({ failImageInsert: true });
  const request = makeUploadRequest();

  const response = await withMutedConsoleError(() =>
    withMockedFetch(telegramSuccessFetch(calls), () =>
      uploadPost({ env, request, params: {} }),
    ),
  );

  assert.equal(response.status, 500);
  assert.equal(calls.puts.length, 1);
  assert.deepEqual(calls.deletedObjects, [calls.puts[0].key]);
  assert.deepEqual(calls.events, ['r2', 'insert', 'r2-delete']);
  assert.equal(calls.telegramRequests.length, 0);
});
