import assert from 'node:assert/strict';
import { onRequestGet as listGrants, onRequestPost as createGrant } from '../functions/api/admin/download-grants.ts';
import {
  onRequestDelete as deleteGrant,
  onRequestPatch as updateGrant,
} from '../functions/api/admin/download-grants/[id].ts';
import { onRequestPost as verifyGrant } from '../functions/api/download-grants/verify.ts';
import { onRequestPost as downloadGrantOriginal } from '../functions/api/download-grants/original/[key].ts';

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const makeAdminRequest = (body) =>
  new Request('http://localhost/api/admin/download-grants', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const makeVisitorRequest = (body) =>
  new Request('https://example.test/api/admin/download-grants', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const makeCreateEnv = ({ existingKeys = ['img-1', 'img-2'], legacyCodeColumn = false } = {}) => {
  const calls = { imageSelect: [], grantInsert: [], grantImageInsert: [] };
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            return {
              all: async () => {
                if (/from\s+images/i.test(sql)) {
                  calls.imageSelect.push({ sql, values });
                  return { results: existingKeys.map((key) => ({ key })) };
                }
                return { results: [] };
              },
              first: async () => null,
              run: async () => {
                if (/insert\s+into\s+download_grants/i.test(sql)) {
                  calls.grantInsert.push({ sql, values });
                  if (legacyCodeColumn && /\bcode\b/i.test(sql)) {
                    throw new Error('table download_grants has no column named code');
                  }
                }
                if (/insert\s+into\s+download_grant_images/i.test(sql)) calls.grantImageInsert.push({ sql, values });
                return { success: true, meta: { changes: 1 } };
              },
            };
          },
        };
      },
      batch: async (statements) => {
        calls.batchSize = statements.length;
        return statements.map(() => ({ success: true }));
      },
    },
  };
  return { env, calls };
};

await test('POST /api/admin/download-grants creates a reusable access code for selected images', async () => {
  const { env, calls } = makeCreateEnv();
  const response = await createGrant({
    env,
    request: makeAdminRequest({
      keys: ['img-1', 'img-2'],
      expires_at: '2999-01-01T00:00:00.000Z',
    }),
  });

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.match(data.code, /^[A-Z0-9]{8}$/);
  assert.equal(data.expires_at, '2999-01-01T00:00:00.000Z');
  assert.equal(data.image_count, 2);
  assert.equal(data.access_url, '/access');
  assert.equal(calls.imageSelect.length, 1);
  assert.equal(calls.grantInsert.length, 1);
  assert.equal(calls.batchSize, 2);
  assert.match(calls.grantInsert[0].sql, /code_hash,\s*code,\s*expires_at/i);
  assert.equal(calls.grantInsert[0].values[2], data.code);
});

await test('POST /api/admin/download-grants still creates grants before the display-code migration is applied', async () => {
  const { env, calls } = makeCreateEnv({ existingKeys: ['img-1'], legacyCodeColumn: true });
  const response = await createGrant({
    env,
    request: makeAdminRequest({
      keys: ['img-1'],
      expires_at: '2999-01-01T00:00:00.000Z',
    }),
  });

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.match(data.code, /^[A-Z0-9]{8}$/);
  assert.equal(data.image_count, 1);
  assert.equal(calls.grantInsert.length, 2);
  assert.match(calls.grantInsert[0].sql, /code_hash,\s*code,\s*expires_at/i);
  assert.match(calls.grantInsert[1].sql, /code_hash,\s*expires_at/i);
});

await test('GET /api/admin/download-grants lists generated codes with grouped images', async () => {
  const adminGrantImageRow = {
    key: 'img-1',
    title: '授权图片',
    caption: null,
    original_filename: 'cat.jpg',
    width: 1200,
    height: 800,
    format: 'webp',
    bytes_compressed: 123456,
    location_name: '管理端可见位置',
    location_lat: 31,
    location_lng: 121,
    location_region: 'china',
    exif_taken_at: null,
    exif_camera: null,
    exif_iso: null,
    exif_aperture: null,
    exif_shutter: null,
    exif_focal_length: null,
    tags_json: null,
    dominant_color: null,
    color_palette_json: null,
    composition: null,
    ai_status: 'done',
    created_at: '2026-05-20 10:11:12',
    updated_at: '2026-05-21 12:13:14',
    is_public: 0,
    location_public: 0,
    folder_id: null,
  };
  const calls = { prepared: [], binds: [] };
  const env = {
    PUBLIC_BASE_URL: 'https://cdn.test',
    DB: {
      prepare(sql) {
        calls.prepared.push(sql);
        return {
          bind(...values) {
            calls.binds.push(values);
            return {
              all: async () => {
                if (/from\s+download_grants/i.test(sql) && !/download_grant_images/i.test(sql)) {
                  return {
                    results: [
                      {
                        id: 'grant-1',
                        code: 'A7K9P2QX',
                        expires_at: '2999-01-01T00:00:00.000Z',
                        created_at: '2026-06-01 10:00:00',
                      },
                    ],
                  };
                }
                if (/from\s+download_grant_images/i.test(sql)) {
                  return { results: [{ grant_id: 'grant-1', ...adminGrantImageRow }] };
                }
                return { results: [] };
              },
            };
          },
        };
      },
    },
  };

  const response = await listGrants({
    env,
    request: new Request('http://localhost/api/admin/download-grants'),
  });

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.grants.length, 1);
  assert.equal(data.grants[0].code, 'A7K9P2QX');
  assert.equal(data.grants[0].image_count, 1);
  assert.equal(data.grants[0].images[0].key, 'img-1');
  assert.equal(data.grants[0].images[0].public_url, 'https://cdn.test/img-1');
  assert.match(calls.prepared[0], /order\s+by\s+created_at\s+desc/i);
});

await test('GET /api/admin/download-grants keeps working before the display-code migration is applied', async () => {
  const env = {
    PUBLIC_BASE_URL: 'https://cdn.test',
    DB: {
      prepare(sql) {
        return {
          bind() {
            return {
              all: async () => {
                if (/from\s+download_grants/i.test(sql) && !/download_grant_images/i.test(sql)) {
                  if (/select\s+id,\s*code,/i.test(sql)) throw new Error('no such column: code');
                  return {
                    results: [
                      {
                        id: 'legacy-grant',
                        code: null,
                        expires_at: '2999-01-01T00:00:00.000Z',
                        created_at: '2026-06-01 10:00:00',
                      },
                    ],
                  };
                }
                return { results: [] };
              },
            };
          },
        };
      },
    },
  };

  const response = await listGrants({
    env,
    request: new Request('http://localhost/api/admin/download-grants'),
  });

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.grants.length, 1);
  assert.equal(data.grants[0].id, 'legacy-grant');
  assert.equal(data.grants[0].code, null);
  assert.equal(data.grants[0].image_count, 0);
});

await test('PATCH /api/admin/download-grants/:id updates expiration', async () => {
  const calls = [];
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            calls.push({ sql, values });
            return {
              first: async () => ({ id: 'grant-1' }),
              run: async () => ({ success: true, meta: { changes: 1 } }),
            };
          },
        };
      },
    },
  };

  const response = await updateGrant({
    env,
    params: { id: 'grant-1' },
    request: new Request('http://localhost/api/admin/download-grants/grant-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expires_at: '2999-02-01T00:00:00.000Z' }),
    }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    id: 'grant-1',
    expires_at: '2999-02-01T00:00:00.000Z',
  });
  assert.match(calls[0].sql, /update\s+download_grants\s+set\s+expires_at\s*=\s*\?/i);
  assert.deepEqual(calls[0].values, ['2999-02-01T00:00:00.000Z', 'grant-1']);
});

await test('DELETE /api/admin/download-grants/:id removes the grant only', async () => {
  const calls = [];
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            calls.push({ sql, values });
            return { run: async () => ({ success: true, meta: { changes: 1 } }) };
          },
        };
      },
    },
  };

  const response = await deleteGrant({
    env,
    params: { id: 'grant-1' },
    request: new Request('http://localhost/api/admin/download-grants/grant-1', { method: 'DELETE' }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, id: 'grant-1' });
  assert.match(calls[0].sql, /delete\s+from\s+download_grants\s+where\s+id\s*=\s*\?/i);
  assert.deepEqual(calls[0].values, ['grant-1']);
});

await test('POST /api/admin/download-grants rejects missing selected images', async () => {
  const { env } = makeCreateEnv({ existingKeys: ['img-1'] });
  const response = await createGrant({
    env,
    request: makeAdminRequest({
      keys: ['img-1', 'img-2'],
      expires_at: '2999-01-01T00:00:00.000Z',
    }),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'image_not_found' });
});

await test('POST /api/admin/download-grants rejects past expiration', async () => {
  const { env } = makeCreateEnv();
  const response = await createGrant({
    env,
    request: makeAdminRequest({
      keys: ['img-1'],
      expires_at: '2000-01-01T00:00:00.000Z',
    }),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'invalid_expiration' });
});

await test('POST /api/admin/download-grants rejects non-admin requests', async () => {
  const { env, calls } = makeCreateEnv();
  const response = await createGrant({
    env,
    request: makeVisitorRequest({
      keys: ['img-1'],
      expires_at: '2999-01-01T00:00:00.000Z',
    }),
  });

  assert.equal(response.status, 401);
  assert.equal(calls.imageSelect.length, 0);
});

const grantImageRow = {
  key: 'img-1',
  title: '授权图片',
  caption: null,
  original_filename: 'cat.jpg',
  width: 1200,
  height: 800,
  format: 'webp',
  bytes_compressed: 123456,
  location_name: '隐藏位置',
  location_lat: 31,
  location_lng: 121,
  location_region: 'china',
  exif_taken_at: null,
  exif_camera: null,
  exif_iso: null,
  exif_aperture: null,
  exif_shutter: null,
  exif_focal_length: null,
  tags_json: null,
  dominant_color: null,
  color_palette_json: null,
  composition: null,
  ai_status: 'done',
  created_at: '2026-05-20 10:11:12',
  updated_at: '2026-05-21 12:13:14',
  is_public: 0,
  location_public: 0,
  folder_id: null,
};

const makeGrantRequest = (url, body) =>
  new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const makeVisitorEnv = ({
  grant = { id: 'grant-1', expires_at: '2999-01-01T00:00:00.000Z' },
  belongs = true,
  tgFileId = 'telegram-file-id',
} = {}) => {
  const calls = { prepared: [], binds: [] };
  const env = {
    PUBLIC_BASE_URL: 'https://cdn.test',
    TG_BOT_TOKEN: 'token-test',
    DB: {
      prepare(sql) {
        calls.prepared.push(sql);
        return {
          bind(...values) {
            calls.binds.push(values);
            return {
              first: async () => {
                if (/from\s+download_grants/i.test(sql)) return grant;
                if (/from\s+download_grant_images/i.test(sql)) return belongs ? { image_key: 'img-1' } : null;
                if (/from\s+images/i.test(sql)) return { key: 'img-1', original_filename: 'cat.jpg', tg_file_id: tgFileId };
                return null;
              },
              all: async () => ({ results: [grantImageRow] }),
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

await test('POST /api/download-grants/verify returns authorized visitor-safe images', async () => {
  const { env } = makeVisitorEnv();
  const response = await verifyGrant({
    env,
    request: makeGrantRequest('https://example.test/api/download-grants/verify', { code: 'A7K9P2QX' }),
  });

  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.expires_at, '2999-01-01T00:00:00.000Z');
  assert.equal(data.images.length, 1);
  assert.equal(data.images[0].key, 'img-1');
  assert.equal(data.images[0].location_name, null);
});

await test('POST /api/download-grants/verify rejects invalid or expired codes', async () => {
  const { env } = makeVisitorEnv({ grant: null });
  const response = await verifyGrant({
    env,
    request: makeGrantRequest('https://example.test/api/download-grants/verify', { code: 'A7K9P2QX' }),
  });

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'download_grant_not_found' });
});

await test('POST /api/download-grants/original/:key streams an authorized original', async () => {
  const { env } = makeVisitorEnv();
  const requests = [];

  const response = await withMockedFetch(
    async (url) => {
      requests.push(String(url));
      if (String(url).includes('/getFile?')) {
        return Response.json({ ok: true, result: { file_path: 'documents/original.jpg' } });
      }
      return new Response('original-bytes', { headers: { 'content-type': 'image/jpeg' } });
    },
    () =>
      downloadGrantOriginal({
        env,
        params: { key: 'img-1' },
        request: makeGrantRequest('https://example.test/api/download-grants/original/img-1', { code: 'A7K9P2QX' }),
      }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(requests, [
    'https://api.telegram.org/bottoken-test/getFile?file_id=telegram-file-id',
    'https://api.telegram.org/file/bottoken-test/documents/original.jpg',
  ]);
  assert.equal(await response.text(), 'original-bytes');
  assert.equal(response.headers.get('content-disposition'), 'attachment; filename="cat.jpg"');
});

await test('POST /api/download-grants/original/:key rejects images outside the grant', async () => {
  const { env } = makeVisitorEnv({ belongs: false });
  const response = await downloadGrantOriginal({
    env,
    params: { key: 'img-2' },
    request: makeGrantRequest('https://example.test/api/download-grants/original/img-2', { code: 'A7K9P2QX' }),
  });

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'download_grant_not_found' });
});

await test('POST /api/download-grants/original/:key returns original_not_archived when Telegram id is missing', async () => {
  const { env } = makeVisitorEnv({ tgFileId: null });
  const response = await downloadGrantOriginal({
    env,
    params: { key: 'img-1' },
    request: makeGrantRequest('https://example.test/api/download-grants/original/img-1', { code: 'A7K9P2QX' }),
  });

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'original_not_archived' });
});
