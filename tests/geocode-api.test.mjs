import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/geocode.ts';

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

await test('GET /api/geocode proxies Nominatim and returns normalized WGS84 results', async () => {
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
        request: new Request('https://imgbed.example.com/api/geocode?q=%E5%A4%96%E6%BB%A9'),
        env: {},
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
  assert.equal(headers.get('referer'), 'https://imgbed.example.com/');
});

await test('GET /api/geocode uses Amap first for domestic searches and converts GCJ-02 to WGS84', async () => {
  const requests = [];

  const response = await withMockedFetch(
    async (url, init) => {
      requests.push({ url: String(url), init });
      return Response.json({
        status: '1',
        pois: [
          {
            name: '清水宫',
            pname: '福建省',
            cityname: '厦门市',
            adname: '湖里区',
            address: '清水宫路',
            location: '118.108622,24.531557',
          },
        ],
      });
    },
    () =>
      onRequestGet({
        request: new Request('https://imgbed.example.com/api/geocode?q=%E5%8E%A6%E9%97%A8%E6%B8%85%E6%B0%B4%E5%AE%AB&region=cn'),
        env: { AMAP_KEY: 'amap-key' },
        params: {},
      }),
  );

  assert.equal(response.status, 200);
  const results = await response.json();
  assert.equal(results.length, 1);
  assert.equal(results[0].name, '清水宫，福建省，厦门市，湖里区，清水宫路');
  assert.ok(Math.abs(results[0].lat - 24.531557) > 0.001);
  assert.ok(Math.abs(results[0].lng - 118.108622) > 0.001);
  assert.ok(results[0].lat > 24.52 && results[0].lat < 24.54);
  assert.ok(results[0].lng > 118.09 && results[0].lng < 118.11);

  assert.equal(requests.length, 1);
  const requestUrl = new URL(requests[0].url);
  assert.equal(requestUrl.origin, 'https://restapi.amap.com');
  assert.equal(requestUrl.pathname, '/v3/place/text');
  assert.equal(requestUrl.searchParams.get('key'), 'amap-key');
  assert.equal(requestUrl.searchParams.get('keywords'), '厦门清水宫');
});

await test('GET /api/geocode uses MapTiler first for global searches', async () => {
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
        request: new Request('https://imgbed.example.com/api/geocode?q=Tokyo%20Tower&region=global'),
        env: { MAPTILER_KEY: 'maptiler-key', AMAP_KEY: 'amap-key' },
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
});

await test('GET /api/geocode falls back to Photon when Nominatim is unreachable', async () => {
  const requests = [];

  const response = await withMockedFetch(
    async (url, init) => {
      requests.push({ url: String(url), init });
      if (requests.length === 1) throw new TypeError('fetch failed');
      return Response.json({
        features: [
          {
            properties: {
              name: '清水宫',
              city: '湖里区',
              country: '中国',
            },
            geometry: {
              coordinates: [118.1086221, 24.5315568],
            },
          },
        ],
      });
    },
    () =>
      onRequestGet({
        request: new Request('https://imgbed.example.com/api/geocode?q=%E6%B8%85%E6%B0%B4%E5%AE%AB'),
        env: {},
        params: {},
      }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [
    {
      name: '清水宫，湖里区，中国',
      lat: 24.5315568,
      lng: 118.1086221,
    },
  ]);
  assert.equal(new URL(requests[0].url).origin, 'https://nominatim.openstreetmap.org');
  assert.equal(new URL(requests[1].url).origin, 'https://photon.komoot.io');
});

await test('GET /api/geocode retries Photon with city-spaced Chinese query when exact query is empty', async () => {
  const requests = [];

  const response = await withMockedFetch(
    async (url) => {
      requests.push(String(url));
      if (requests.length === 1) throw new TypeError('fetch failed');
      if (requests.length === 2) return Response.json({ features: [] });
      return Response.json({
        features: [
          {
            properties: {
              name: '清水宫',
              city: '湖里区',
              state: '福建省',
              country: '中国',
            },
            geometry: {
              coordinates: [118.1086221, 24.5315568],
            },
          },
        ],
      });
    },
    () =>
      onRequestGet({
        request: new Request('https://imgbed.example.com/api/geocode?q=%E5%8E%A6%E9%97%A8%E6%B8%85%E6%B0%B4%E5%AE%AB'),
        env: {},
        params: {},
      }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [
    {
      name: '清水宫，湖里区，福建省，中国',
      lat: 24.5315568,
      lng: 118.1086221,
    },
  ]);
  assert.equal(new URL(requests[1]).searchParams.get('q'), '厦门清水宫');
  assert.equal(new URL(requests[2]).searchParams.get('q'), '厦门 清水宫');
});

await test('GET /api/geocode rejects empty query before calling Nominatim', async () => {
  let fetchCalled = false;

  const response = await withMockedFetch(
    async () => {
      fetchCalled = true;
      return Response.json([]);
    },
    () =>
      onRequestGet({
        request: new Request('https://imgbed.example.com/api/geocode?q='),
        env: {},
        params: {},
      }),
  );

  assert.equal(response.status, 400);
  assert.equal(fetchCalled, false);
});
