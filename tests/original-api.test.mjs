import assert from 'node:assert/strict';
import { onRequestGet as originalGet } from '../functions/api/original/[key].ts';

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
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

const makeAdminRequest = (url) =>
  new Request(url, {
    headers: {
      'Cf-Access-Authenticated-User-Email': 'owner@example.test',
    },
  });

const makeEnv = (row) => {
  const calls = {
    selectedKey: null,
  };

  const env = {
    TG_BOT_TOKEN: 'token-test',
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            return {
              first: async () => {
                calls.selectedKey = values[0];
                assert.match(sql, /SELECT/i);
                assert.match(sql, /\boriginal_filename\b/i);
                assert.match(sql, /\btg_file_id\b/i);
                return row;
              },
            };
          },
        };
      },
    },
  };

  return { env, calls };
};

await test('GET /api/original/:key streams the Telegram original as an attachment', async () => {
  const { env, calls } = makeEnv({
    key: 'img-key',
    title: '猫猫',
    original_filename: 'cat.jpg',
    tg_file_id: 'telegram-file-id',
  });
  const requests = [];

  const response = await withMockedFetch(
    async (url) => {
      requests.push(String(url));
      if (String(url).includes('/getFile?')) {
        return Response.json({
          ok: true,
          result: { file_path: 'documents/original.jpg' },
        });
      }
      return new Response('original-bytes', {
        headers: {
          'content-type': 'image/jpeg',
        },
      });
    },
    () =>
      originalGet({
        env,
        params: { key: 'img-key' },
        request: makeAdminRequest('http://x/api/original/img-key'),
      }),
  );

  assert.equal(calls.selectedKey, 'img-key');
  assert.deepEqual(requests, [
    'https://api.telegram.org/bottoken-test/getFile?file_id=telegram-file-id',
    'https://api.telegram.org/file/bottoken-test/documents/original.jpg',
  ]);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'original-bytes');
  assert.equal(response.headers.get('content-type'), 'image/jpeg');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('content-disposition'), 'attachment; filename="cat.jpg"');
});

await test('GET /api/original/:key returns 404 when the image is missing', async () => {
  const { env } = makeEnv(null);
  let fetchCount = 0;

  const response = await withMockedFetch(
    async () => {
      fetchCount += 1;
      throw new Error('fetch should not run');
    },
    () =>
      originalGet({
        env,
        params: { key: 'missing-key' },
        request: makeAdminRequest('http://x/api/original/missing-key'),
      }),
  );

  assert.equal(response.status, 404);
  assert.equal(fetchCount, 0);
});

await test('GET /api/original/:key returns 404 when the original is not archived', async () => {
  const { env } = makeEnv({ key: 'img-key', title: '猫猫', original_filename: 'cat.jpg', tg_file_id: null });

  const response = await originalGet({
    env,
    params: { key: 'img-key' },
    request: makeAdminRequest('http://x/api/original/img-key'),
  });

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'original_not_archived' });
});
