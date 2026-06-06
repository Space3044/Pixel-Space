import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/staticmap.ts';
import { onRequestGet as adminStaticMapGet } from '../functions/api/admin/staticmap.ts';

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

const makeEnv = ({ cached = null, token = 'pk.mb-token', amapWebKey = 'amap-web-key', publicLocation = true } = {}) => {
  const puts = [];
  const visibilityChecks = [];
  return {
    puts,
    visibilityChecks,
    env: {
      MAPBOX_PUBLIC_TOKEN: token,
      AMAP_WEB_KEY: amapWebKey,
      BUCKET: {
        get: async () => cached,
        put: async (k, body, options) => {
          puts.push({ key: k, body, options });
        },
      },
      DB: {
        prepare(sql) {
          return {
            bind(...values) {
              visibilityChecks.push({ sql, values });
              return {
                first: async () => (publicLocation ? { key: 'images/public-location' } : null),
              };
            },
          };
        },
      },
    },
  };
};

const call = (env, url, init) => onRequestGet({ env, params: {}, request: new Request(url, init) });
const callAdmin = (env, url, init) => adminStaticMapGet({ env, params: {}, request: new Request(url, init) });

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

await test('GET /api/staticmap rejects requests without a valid region', async () => {
  let fetchCalled = false;
  const { env } = makeEnv();
  const response = await withMockedFetch(
    async () => {
      fetchCalled = true;
      return pngResponse();
    },
    () => call(env, 'https://x/api/staticmap?lat=31.2304&lng=121.4737'),
  );
  assert.equal(response.status, 400);
  assert.match(await response.text(), /invalid_region/);
  assert.equal(fetchCalled, false);
});

await test('GET /api/staticmap serves the R2-cached image without calling Mapbox', async () => {
  let fetchCalled = false;
  const { env, puts, visibilityChecks } = makeEnv({
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
    () => call(env, 'https://x/api/staticmap?lat=31.2304&lng=121.4737&region=china'),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.equal(await response.text(), 'cached-png');
  assert.equal(fetchCalled, false, 'cache hit must not call Mapbox');
  assert.equal(puts.length, 0, 'cache hit must not rewrite R2');
  assert.match(visibilityChecks[0].sql, /is_public\s*=\s*1/i);
  assert.match(visibilityChecks[0].sql, /location_public\s*=\s*1/i);
  assert.match(visibilityChecks[0].sql, /location_region\s*=\s*\?/i);
  assert.deepEqual(visibilityChecks[0].values, ['china', '31.230400', '121.473700']);
});

await test('GET /api/staticmap returns 404 for visitor cache misses without calling Mapbox', async () => {
  let fetchCalled = false;
  const { env, puts } = makeEnv();
  const response = await withMockedFetch(
    async () => {
      fetchCalled = true;
      return pngResponse();
    },
    () => call(env, 'https://x/api/staticmap?lat=31.2304&lng=121.4737&region=china'),
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'not_found' });
  assert.equal(fetchCalled, false);
  assert.equal(puts.length, 0);
});

await test('GET /api/staticmap stays read-only on localhost public route', async () => {
  let fetchCalled = false;
  const { env, puts } = makeEnv();
  const response = await withMockedFetch(
    async () => {
      fetchCalled = true;
      return pngResponse();
    },
    () => call(env, 'http://localhost/api/staticmap?lat=31.2304&lng=121.4737&region=china'),
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'not_found' });
  assert.equal(fetchCalled, false);
  assert.equal(puts.length, 0);
});

await test('GET /api/staticmap does not serve cached maps for private or hidden visitor locations', async () => {
  let fetchCalled = false;
  const { env, puts } = makeEnv({
    publicLocation: false,
    cached: {
      body: new Blob(['hidden-map'], { type: 'image/png' }).stream(),
      httpEtag: '"etag-hidden"',
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
    () => call(env, 'https://x/api/staticmap?lat=31.2304&lng=121.4737&region=china'),
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'not_found' });
  assert.equal(fetchCalled, false);
  assert.equal(puts.length, 0);
});

await test('GET /api/admin/staticmap lets admins generate and cache a missing China static map with AMap', async () => {
  const requests = [];
  const { env, puts } = makeEnv();
  const response = await withMockedFetch(
    async (url) => {
      requests.push(String(url));
      return pngResponse();
    },
    () => callAdmin(env, 'http://localhost/api/admin/staticmap?lat=31.2304&lng=121.4737&region=china'),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.equal(requests.length, 1);

  const url = new URL(requests[0]);
  assert.equal(url.origin, 'https://restapi.amap.com');
  assert.equal(url.pathname, '/v3/staticmap');
  assert.equal(url.searchParams.get('key'), 'amap-web-key');
  assert.equal(url.searchParams.has('style'), false);
  assert.equal(url.searchParams.get('zoom'), '12');
  assert.equal(url.searchParams.get('size'), '600*360');
  assert.match(url.searchParams.get('location'), /^121\.478[0-9]+,31\.228[0-9]+$/, 'AMap receives GCJ-02 coordinates');
  assert.match(url.searchParams.get('markers'), /121\.478[0-9]+,31\.228[0-9]+$/, 'marker uses GCJ-02 coordinates');

  assert.equal(puts.length, 1);
  assert.equal(puts[0].key, 'staticmap/amap_31.230400_121.473700_z12_600x360.png');
  assert.equal(puts[0].options.httpMetadata.contentType, 'image/png');
});

await test('GET /api/admin/staticmap lets admins generate and cache a missing global static map with Mapbox', async () => {
  const requests = [];
  const { env, puts } = makeEnv();
  const response = await withMockedFetch(
    async (url) => {
      requests.push(String(url));
      return pngResponse();
    },
    () => callAdmin(env, 'http://localhost/api/admin/staticmap?lat=48.8566&lng=2.3522&region=global'),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.equal(requests.length, 1);

  const url = new URL(requests[0]);
  assert.equal(url.origin, 'https://api.mapbox.com');
  assert.ok(url.pathname.includes('/styles/v1/mapbox/dark-v11/static/'), 'uses the dark Mapbox style');
  assert.equal(url.searchParams.get('access_token'), 'pk.mb-token');
  assert.ok(url.pathname.includes('pin-s+ff4fd8(2.352200,48.856600)'), 'pink marker at the raw coordinate');
  assert.ok(url.pathname.includes('2.352200,48.856600,12'), 'center uses raw WGS-84 + zoom');

  assert.equal(puts.length, 1);
  assert.equal(puts[0].key, 'staticmap/mapbox_48.856600_2.352200_z12_600x360.png');
  assert.equal(puts[0].options.httpMetadata.contentType, 'image/png');
});

await test('GET /api/admin/staticmap fails clearly when the AMap Web key is missing for China maps', async () => {
  let fetchCalled = false;
  const { env } = makeEnv({ amapWebKey: null });
  const response = await withMockedFetch(
    async () => {
      fetchCalled = true;
      return pngResponse();
    },
    () => callAdmin(env, 'http://localhost/api/admin/staticmap?lat=31.2304&lng=121.4737&region=china'),
  );
  assert.equal(response.status, 500);
  assert.match(await response.text(), /amap_web_key_missing/);
  assert.equal(fetchCalled, false);
});

await test('GET /api/admin/staticmap fails clearly when the Mapbox token is missing', async () => {
  let fetchCalled = false;
  const { env } = makeEnv({ token: null });
  const response = await withMockedFetch(
    async () => {
      fetchCalled = true;
      return pngResponse();
    },
    () => callAdmin(env, 'http://localhost/api/admin/staticmap?lat=48.8566&lng=2.3522&region=global'),
  );
  assert.equal(response.status, 500);
  assert.match(await response.text(), /mapbox_public_token_missing/);
  assert.equal(fetchCalled, false);
});

await test('GET /api/admin/staticmap rejects a non-public Mapbox token', async () => {
  let fetchCalled = false;
  const { env } = makeEnv({ token: 'sk.secret-token' });
  const response = await withMockedFetch(
    async () => {
      fetchCalled = true;
      return pngResponse();
    },
    () => callAdmin(env, 'http://localhost/api/admin/staticmap?lat=48.8566&lng=2.3522&region=global'),
  );
  assert.equal(response.status, 500);
  assert.match(await response.text(), /mapbox_public_token_invalid/);
  assert.equal(fetchCalled, false);
});

await test('GET /api/admin/staticmap rejects non-image upstream responses', async () => {
  const { env, puts } = makeEnv();
  const response = await withMockedFetch(
    async () => Response.json({ message: 'Not Authorized - Invalid Token' }, { status: 401 }),
    () => callAdmin(env, 'http://localhost/api/admin/staticmap?lat=48.8566&lng=2.3522&region=global'),
  );
  assert.equal(response.status, 500);
  assert.match(await response.text(), /mapbox_staticmap_failed/);
  assert.equal(puts.length, 0);
});
