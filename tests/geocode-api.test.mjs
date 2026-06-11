import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/admin/geocode.ts';

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

const captureConsole = async (method, fn) => {
  const original = console[method];
  const lines = [];
  console[method] = (line) => {
    lines.push(String(line));
  };
  try {
    await fn();
  } finally {
    console[method] = original;
  }
  return lines;
};

const makeEnv = (env = {}) => env;

await test('GET /api/admin/geocode rejects production visitors before calling upstream providers', async () => {
  let fetchCalled = false;

  const response = await withMockedFetch(
    async () => {
      fetchCalled = true;
      return Response.json([]);
    },
    () =>
      onRequestGet({
        request: new Request('https://imgbed.example.com/api/admin/geocode?q=Tokyo&region=global'),
        env: makeEnv(),
        params: {},
      }),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'unauthorized' });
  assert.equal(fetchCalled, false);
});

await test('GET /api/admin/geocode proxies Nominatim and returns normalized WGS84 results', async () => {
  const requests = [];

  const response = await withMockedFetch(
    async (url, init) => {
      requests.push({ url: String(url), init });
      return Response.json([
        { display_name: '上海市黄浦区外滩', lat: '31.2397', lon: '121.4998' },
        { display_name: 'bad row', lat: 'not-a-number', lon: '121.1' },
      ]);
    },
    () =>
      onRequestGet({
        request: new Request('http://localhost/api/admin/geocode?q=%E5%A4%96%E6%BB%A9&region=global'),
        env: makeEnv(),
        params: {},
      }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [
    {
      name: '上海市黄浦区外滩',
      lat: 31.2397,
      lng: 121.4998,
    },
  ]);
  assert.equal(requests.length, 1);

  const requestUrl = new URL(requests[0].url);
  assert.equal(requestUrl.origin, 'https://nominatim.openstreetmap.org');
  assert.equal(requestUrl.pathname, '/search');
  assert.equal(requestUrl.searchParams.get('format'), 'jsonv2');
  assert.equal(requestUrl.searchParams.get('q'), '外滩');
  assert.equal(requestUrl.searchParams.get('limit'), '5');
  assert.equal(requestUrl.searchParams.get('addressdetails'), '1');

  const headers = new Headers(requests[0].init.headers);
  assert.match(headers.get('user-agent'), /imgbed-geocoder/i);
  assert.equal(headers.get('referer'), 'http://localhost/');
  assert.equal(requestUrl.searchParams.get('accept-language'), 'en');
});

await test('GET /api/admin/geocode keeps domestic searches out of the backend', async () => {
  let fetchCalled = false;

  const response = await withMockedFetch(
    async () => {
      fetchCalled = true;
      return Response.json([]);
    },
    () =>
      onRequestGet({
        request: new Request('http://localhost/api/admin/geocode?q=%E5%8E%A6%E9%97%A8&region=cn'),
        env: makeEnv({ MAPTILER_KEY: 'maptiler-key' }),
        params: {},
      }),
  );

  assert.equal(response.status, 400);
  assert.match(await response.text(), /domestic_geocode_uses_amap_js_api/);
  assert.equal(fetchCalled, false);
});

await test('GET /api/admin/geocode uses Mapbox first for global searches', async () => {
  const requests = [];

  const response = await withMockedFetch(
    async (url, init) => {
      requests.push({ url: String(url), init });
      return Response.json({
        features: [
          {
            place_name: 'Tokyo Tower, Tokyo, Japan',
            geometry: {
              coordinates: [139.745433, 35.658581],
            },
          },
        ],
      });
    },
    () =>
      onRequestGet({
        request: new Request('http://localhost/api/admin/geocode?q=Tokyo%20Tower&region=global'),
        env: makeEnv({ MAPBOX_PUBLIC_TOKEN: 'pk.mapbox-token', MAPTILER_KEY: 'maptiler-key' }),
        params: {},
      }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [
    {
      name: 'Tokyo Tower, Tokyo, Japan',
      lat: 35.658581,
      lng: 139.745433,
    },
  ]);

  assert.equal(requests.length, 1);
  const requestUrl = new URL(requests[0].url);
  assert.equal(requestUrl.origin, 'https://api.mapbox.com');
  assert.equal(requestUrl.pathname, '/geocoding/v5/mapbox.places/Tokyo%20Tower.json');
  assert.equal(requestUrl.searchParams.get('access_token'), 'pk.mapbox-token');
  assert.equal(requestUrl.searchParams.get('limit'), '5');
  assert.equal(requestUrl.searchParams.get('language'), 'en');
});

await test('GET /api/admin/geocode falls back to MapTiler for global searches', async () => {
  const requests = [];

  const response = await withMockedFetch(
    async (url, init) => {
      requests.push({ url: String(url), init });
      return Response.json({
        features: [
          {
            place_name: 'Tokyo Tower, Tokyo, Japan',
            geometry: {
              coordinates: [139.745433, 35.658581],
            },
          },
        ],
      });
    },
    () =>
      onRequestGet({
        request: new Request('http://localhost/api/admin/geocode?q=Tokyo%20Tower&region=global'),
        env: makeEnv({ MAPTILER_KEY: 'maptiler-key' }),
        params: {},
      }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [
    {
      name: 'Tokyo Tower, Tokyo, Japan',
      lat: 35.658581,
      lng: 139.745433,
    },
  ]);

  assert.equal(requests.length, 1);
  const requestUrl = new URL(requests[0].url);
  assert.equal(requestUrl.origin, 'https://api.maptiler.com');
  assert.equal(requestUrl.pathname, '/geocoding/Tokyo%20Tower.json');
  assert.equal(requestUrl.searchParams.get('key'), 'maptiler-key');
  assert.equal(requestUrl.searchParams.get('limit'), '5');
  assert.equal(requestUrl.searchParams.get('language'), 'en');
});

await test('GET /api/admin/geocode uses Mapbox first for global reverse geocoding', async () => {
  const requests = [];

  const response = await withMockedFetch(
    async (url, init) => {
      requests.push({ url: String(url), init });
      return Response.json({
        features: [
          {
            place_name: 'Eiffel Tower, Paris, France',
            center: [2.294481, 48.85837],
          },
        ],
      });
    },
    () =>
      onRequestGet({
        request: new Request('http://localhost/api/admin/geocode?lat=48.85837&lng=2.294481&region=global'),
        env: makeEnv({ MAPBOX_PUBLIC_TOKEN: 'pk.mapbox-token', MAPTILER_KEY: 'maptiler-key' }),
        params: {},
      }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [
    {
      name: 'Eiffel Tower, Paris, France',
      lat: 48.85837,
      lng: 2.294481,
    },
  ]);

  assert.equal(requests.length, 1);
  const requestUrl = new URL(requests[0].url);
  assert.equal(requestUrl.origin, 'https://api.mapbox.com');
  assert.equal(requestUrl.pathname, '/geocoding/v5/mapbox.places/2.294481,48.85837.json');
  assert.equal(requestUrl.searchParams.get('access_token'), 'pk.mapbox-token');
  assert.equal(requestUrl.searchParams.get('limit'), null);
  assert.equal(requestUrl.searchParams.get('language'), 'en');
});

await test('GET /api/admin/geocode falls back to MapTiler for global reverse geocoding', async () => {
  const requests = [];

  const response = await withMockedFetch(
    async (url, init) => {
      requests.push({ url: String(url), init });
      return Response.json({
        features: [
          {
            place_name: 'Eiffel Tower, Paris, France',
            center: [2.294481, 48.85837],
          },
        ],
      });
    },
    () =>
      onRequestGet({
        request: new Request('http://localhost/api/admin/geocode?lat=48.85837&lng=2.294481&region=global'),
        env: makeEnv({ MAPTILER_KEY: 'maptiler-key' }),
        params: {},
      }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [
    {
      name: 'Eiffel Tower, Paris, France',
      lat: 48.85837,
      lng: 2.294481,
    },
  ]);

  assert.equal(requests.length, 1);
  const requestUrl = new URL(requests[0].url);
  assert.equal(requestUrl.origin, 'https://api.maptiler.com');
  assert.equal(requestUrl.pathname, '/geocoding/2.294481,48.85837.json');
  assert.equal(requestUrl.searchParams.get('key'), 'maptiler-key');
  assert.equal(requestUrl.searchParams.get('limit'), '1');
  assert.equal(requestUrl.searchParams.get('language'), 'en');
});

await test('GET /api/admin/geocode falls back to Nominatim for global reverse geocoding', async () => {
  const requests = [];

  const response = await withMockedFetch(
    async (url, init) => {
      requests.push({ url: String(url), init });
      return Response.json({
        display_name: 'Tour Eiffel, Paris, France',
        lat: '48.85837',
        lon: '2.294481',
      });
    },
    () =>
      onRequestGet({
        request: new Request('http://localhost/api/admin/geocode?lat=48.85837&lng=2.294481&region=global'),
        env: makeEnv(),
        params: {},
      }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [
    {
      name: 'Tour Eiffel, Paris, France',
      lat: 48.85837,
      lng: 2.294481,
    },
  ]);

  assert.equal(requests.length, 1);
  const requestUrl = new URL(requests[0].url);
  assert.equal(requestUrl.origin, 'https://nominatim.openstreetmap.org');
  assert.equal(requestUrl.pathname, '/reverse');
  assert.equal(requestUrl.searchParams.get('format'), 'jsonv2');
  assert.equal(requestUrl.searchParams.get('lat'), '48.85837');
  assert.equal(requestUrl.searchParams.get('lon'), '2.294481');
  assert.equal(requestUrl.searchParams.get('zoom'), '18');
  assert.equal(requestUrl.searchParams.get('addressdetails'), '1');

  const headers = new Headers(requests[0].init.headers);
  assert.match(headers.get('user-agent'), /imgbed-geocoder/i);
  assert.equal(headers.get('referer'), 'http://localhost/');
  assert.equal(requestUrl.searchParams.get('accept-language'), 'en');
});

await test('GET /api/admin/geocode stops after Nominatim for global searches', async () => {
  const requests = [];

  const response = await withMockedFetch(
    async (url, init) => {
      requests.push({ url: String(url), init });
      return Response.json([]);
    },
    () =>
      onRequestGet({
        request: new Request('http://localhost/api/admin/geocode?q=Unknown%20Place&region=global'),
        env: makeEnv(),
        params: {},
      }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), []);
  assert.equal(new URL(requests[0].url).origin, 'https://nominatim.openstreetmap.org');
  assert.equal(requests.length, 1);
});

await test('GET /api/admin/geocode stops after Nominatim for global reverse geocoding', async () => {
  const requests = [];

  const response = await withMockedFetch(
    async (url, init) => {
      requests.push({ url: String(url), init });
      return Response.json({});
    },
    () =>
      onRequestGet({
        request: new Request('http://localhost/api/admin/geocode?lat=48.85837&lng=2.294481&region=global'),
        env: makeEnv(),
        params: {},
      }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), []);
  assert.equal(new URL(requests[0].url).origin, 'https://nominatim.openstreetmap.org');
  assert.equal(new URL(requests[0].url).pathname, '/reverse');
  assert.equal(requests.length, 1);
});

await test('GET /api/admin/geocode logs the provider fallback path without the full search query', async () => {
  const lines = await captureConsole('info', async () => {
    const response = await withMockedFetch(
      async (url) => {
        const origin = new URL(String(url)).origin;
        if (origin === 'https://nominatim.openstreetmap.org') {
          throw new TypeError('Nominatim should not be called after MapTiler hits');
        }
        return Response.json({
          features: [
            {
              place_name: 'Tokyo Tower, Tokyo, Japan',
              geometry: {
                coordinates: [139.745433, 35.658581],
              },
            },
          ],
        });
      },
      () =>
        onRequestGet({
          request: new Request('http://localhost/api/admin/geocode?q=Tokyo%20Tower&region=global'),
          env: makeEnv({ MAPTILER_KEY: 'maptiler-key' }),
          params: {},
        }),
    );
    assert.equal(response.status, 200);
  });

  const providerLog = lines.map((line) => JSON.parse(line)).find((entry) => entry.message === 'geocode provider attempts');
  assert.ok(providerLog);
  assert.equal(providerLog.context.kind, 'search');
  assert.equal(providerLog.context.region, 'global');
  assert.deepEqual(
    providerLog.context.attempts.map(({ provider, outcome, resultCount }) => ({ provider, outcome, resultCount })),
    [
      { provider: 'mapbox', outcome: 'skipped', resultCount: 0 },
      { provider: 'maptiler', outcome: 'hit', resultCount: 1 },
    ],
  );
  assert.equal(providerLog.context.query, undefined);
  assert.doesNotMatch(lines.join('\n'), /Tokyo/);
  assert.ok(providerLog.context.attempts.every((attempt) => typeof attempt.durationMs === 'number'));
});

await test('GET /api/admin/geocode logs reverse provider hits without exact coordinates', async () => {
  const lines = await captureConsole('info', async () => {
    const response = await withMockedFetch(
      async () =>
        Response.json({
          features: [
            {
              place_name: 'Eiffel Tower, Paris, France',
              center: [2.294481, 48.85837],
            },
          ],
        }),
      () =>
        onRequestGet({
          request: new Request('http://localhost/api/admin/geocode?lat=48.85837&lng=2.294481&region=global'),
          env: makeEnv({ MAPTILER_KEY: 'maptiler-key' }),
          params: {},
        }),
    );
    assert.equal(response.status, 200);
  });

  const providerLog = lines.map((line) => JSON.parse(line)).find((entry) => entry.message === 'geocode provider attempts');
  assert.ok(providerLog);
  assert.equal(providerLog.context.kind, 'reverse');
  assert.deepEqual(
    providerLog.context.attempts.map(({ provider, outcome, resultCount }) => ({ provider, outcome, resultCount })),
    [
      { provider: 'mapbox', outcome: 'skipped', resultCount: 0 },
      { provider: 'maptiler', outcome: 'hit', resultCount: 1 },
    ],
  );
  assert.equal(providerLog.context.coordinate, undefined);
  assert.doesNotMatch(lines.join('\n'), /48\.85837|2\.294481/);
});

await test('GET /api/admin/geocode error log keeps provider errors summarized', async () => {
  const lines = await captureConsole('error', async () => {
    const response = await withMockedFetch(
      async () => {
        throw new TypeError('fetch failed');
      },
      () =>
        onRequestGet({
          request: new Request('http://localhost/api/admin/geocode?q=Tokyo&region=global'),
          env: makeEnv(),
          params: {},
        }),
    );
    assert.equal(response.status, 500);
  });

  const failureLog = lines.map((line) => JSON.parse(line)).find((entry) => entry.message === 'GET /api/admin/geocode failed');
  assert.ok(failureLog);
  assert.equal(failureLog.context.kind, 'search');
  assert.equal(failureLog.context.region, 'global');
  assert.equal(failureLog.context.providerErrors, undefined);
  assert.equal(failureLog.context.firstError, 'fetch failed');
  assert.deepEqual(
    failureLog.context.attempts.map(({ provider, outcome, resultCount }) => ({ provider, outcome, resultCount })),
    [
      { provider: 'mapbox', outcome: 'skipped', resultCount: 0 },
      { provider: 'maptiler', outcome: 'skipped', resultCount: 0 },
      { provider: 'nominatim', outcome: 'error', resultCount: 0 },
    ],
  );
  assert.doesNotMatch(lines.join('\n'), /Tokyo/);
});

await test('GET /api/admin/geocode rejects empty query before calling Nominatim', async () => {
  let fetchCalled = false;

  const response = await withMockedFetch(
    async () => {
      fetchCalled = true;
      return Response.json([]);
    },
    () =>
      onRequestGet({
        request: new Request('http://localhost/api/admin/geocode?q='),
        env: makeEnv(),
        params: {},
      }),
  );

  assert.equal(response.status, 400);
  assert.equal(fetchCalled, false);
});
