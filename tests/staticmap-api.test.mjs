import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/staticmap.ts';
import { wgs84ToGcj02 as serverWgs84ToGcj02 } from '../functions/_shared/gcj02.ts';
import { wgs84ToGcj02 as clientWgs84ToGcj02 } from '../src/features/upload/map-coordinate.ts';

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

const makeEnv = ({ cached = null, key = 'web-key' } = {}) => {
  const puts = [];
  return {
    puts,
    env: {
      AMAP_WEB_KEY: key,
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

await test('GET /api/staticmap serves the R2-cached image without calling AMap', async () => {
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
  assert.equal(fetchCalled, false, 'cache hit must not call AMap');
  assert.equal(puts.length, 0, 'cache hit must not rewrite R2');
});

await test('GET /api/staticmap calls AMap with GCJ-02 coordinates and caches the result', async () => {
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
  assert.equal(url.origin, 'https://restapi.amap.com');
  assert.equal(url.pathname, '/v3/staticmap');
  assert.equal(url.searchParams.get('key'), 'web-key');

  const location = url.searchParams.get('location');
  const [lngStr, latStr] = location.split(',');
  const gcj = serverWgs84ToGcj02(121.4737, 31.2304);
  assert.equal(lngStr, gcj.lng.toFixed(6));
  assert.equal(latStr, gcj.lat.toFixed(6));
  assert.notEqual(lngStr, (121.4737).toFixed(6), 'domestic coordinate must be shifted to GCJ-02');
  assert.ok(url.searchParams.get('markers').endsWith(`:${location}`), 'marker sits on the center point');

  assert.equal(puts.length, 1);
  assert.match(puts[0].key, /^staticmap\//);
  assert.equal(puts[0].options.httpMetadata.contentType, 'image/png');
});

await test('GET /api/staticmap fails clearly when the Web service key is missing', async () => {
  let fetchCalled = false;
  const { env } = makeEnv({ key: null });
  const response = await withMockedFetch(
    async () => {
      fetchCalled = true;
      return pngResponse();
    },
    () => call(env, 'https://x/api/staticmap?lat=31.2304&lng=121.4737'),
  );
  assert.equal(response.status, 500);
  assert.match(await response.text(), /amap_web_key_missing/);
  assert.equal(fetchCalled, false);
});

await test('GET /api/staticmap rejects non-image upstream responses', async () => {
  const { env, puts } = makeEnv();
  const response = await withMockedFetch(
    async () => Response.json({ status: '0', info: 'INVALID_USER_KEY' }),
    () => call(env, 'https://x/api/staticmap?lat=31.2304&lng=121.4737'),
  );
  assert.equal(response.status, 500);
  assert.match(await response.text(), /amap_staticmap_failed/);
  assert.equal(puts.length, 0);
});

await test('server-side GCJ-02 conversion matches the client map-coordinate module', () => {
  for (const [lng, lat] of [
    [121.4737, 31.2304],
    [116.3974, 39.9093],
    [-0.1276, 51.5072],
  ]) {
    const server = serverWgs84ToGcj02(lng, lat);
    const client = clientWgs84ToGcj02(lng, lat);
    assert.equal(server.lng.toFixed(9), client.lng.toFixed(9));
    assert.equal(server.lat.toFixed(9), client.lat.toFixed(9));
  }
});
