import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/mapbox-config.ts';

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

await test('GET /api/mapbox-config returns the browser Mapbox token', async () => {
  const res = await onRequestGet({
    env: { MAPBOX_TOKEN: 'pk.test-token' },
    request: new Request('http://local/api/mapbox-config'),
    params: {},
  });

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { token: 'pk.test-token' });
});

await test('GET /api/mapbox-config rejects a missing Mapbox token', async () => {
  const res = await onRequestGet({
    env: {},
    request: new Request('http://local/api/mapbox-config'),
    params: {},
  });

  assert.equal(res.status, 500);
  assert.match(await res.text(), /mapbox_token_missing/);
});
