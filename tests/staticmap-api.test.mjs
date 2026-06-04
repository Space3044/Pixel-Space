import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/staticmap.ts';

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

const pngResponse = () =>
  new Response(new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }), {
    headers: { 'content-type': 'image/png' },
  });

const makeEnv = ({ cached = null, token = 'mb-token' } = {}) => {
  const puts = [];
  return {
    puts,
    env: {
      MAPBOX_TOKEN: token,
      BUCKET: {
        get: async () => cached,
        put: async (k, body, options) => {
          puts.push({ key: k, body, options });
        },
      },
    },
  };
};

const call = (env, url) => onRequestGet({ env, params: {}, request: new Request(url) });

await test('GET /api/staticmap rejects requests without valid coordinates', async () => {
  let fetchCalled = false;
  const { env } = makeEnv();
  const response = await withMockedFetch(
    async () => {
      fetchCalled = true;
      return pngResponse();
    },
    () => call(env, 'https://x/api/staticmap?lat=200&lng=10'),
  );
  assert.equal(response.status, 400);
  assert.equal(fetchCalled, false);
});

await test('GET /api/staticmap serves the R2-cached image without calling Mapbox', async () => {
  let fetchCalled = false;
  const { env, puts } = makeEnv({
    cached: {
      body: new Blob(['cached-png'], { type: 'image/png' }).stream(),
      httpEtag: '"etag-loc"',
      writeHttpMetadata(headers) {
        headers.set('content-type', 'image/png');
      },
    },
  });
  const response = await withMockedFetch(
    async () => {
      fetchCalled = true;
      return pngResponse();
    },
    () => call(env, 'https://x/api/staticmap?lat=31.2304&lng=121.4737'),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.equal(await response.text(), 'cached-png');
  assert.equal(fetchCalled, false, 'cache hit must not call Mapbox');
  assert.equal(puts.length, 0, 'cache hit must not rewrite R2');
});

await test('GET /api/staticmap calls Mapbox with WGS-84 coordinates and caches the result', async () => {
  const requests = [];
  const { env, puts } = makeEnv();
  const response = await withMockedFetch(
    async (url) => {
      requests.push(String(url));
      return pngResponse();
    },
    () => call(env, 'https://x/api/staticmap?lat=31.2304&lng=121.4737'),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.equal(requests.length, 1);

  const url = new URL(requests[0]);
  assert.equal(url.origin, 'https://api.mapbox.com');
  assert.ok(url.pathname.includes('/styles/v1/mapbox/dark-v11/static/'), 'uses the dark Mapbox style');
  assert.equal(url.searchParams.get('access_token'), 'mb-token');
  // 坐标直接用 WGS-84，不做 GCJ 偏移，marker 与中心点都落在原始经纬度上。
  assert.ok(url.pathname.includes('pin-s+ff4fd8(121.473700,31.230400)'), 'pink marker at the raw coordinate');
  assert.ok(url.pathname.includes('121.473700,31.230400,12'), 'center uses raw WGS-84 + zoom');

  assert.equal(puts.length, 1);
  assert.match(puts[0].key, /^staticmap\/mapbox_/);
  assert.equal(puts[0].options.httpMetadata.contentType, 'image/png');
});

await test('GET /api/staticmap fails clearly when the Mapbox token is missing', async () => {
  let fetchCalled = false;
  const { env } = makeEnv({ token: null });
  const response = await withMockedFetch(
    async () => {
      fetchCalled = true;
      return pngResponse();
    },
    () => call(env, 'https://x/api/staticmap?lat=31.2304&lng=121.4737'),
  );
  assert.equal(response.status, 500);
  assert.match(await response.text(), /mapbox_token_missing/);
  assert.equal(fetchCalled, false);
});

await test('GET /api/staticmap rejects non-image upstream responses', async () => {
  const { env, puts } = makeEnv();
  const response = await withMockedFetch(
    async () => Response.json({ message: 'Not Authorized - Invalid Token' }, { status: 401 }),
    () => call(env, 'https://x/api/staticmap?lat=31.2304&lng=121.4737'),
  );
  assert.equal(response.status, 500);
  assert.match(await response.text(), /mapbox_staticmap_failed/);
  assert.equal(puts.length, 0);
});
