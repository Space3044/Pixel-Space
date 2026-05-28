import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/amap-config.ts';

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

await test('GET /api/amap-config returns the browser AMap key and optional security code', async () => {
  const res = await onRequestGet({
    env: { AMAP_JS_KEY: 'js-key', AMAP_SECURITY_JS_CODE: 'security-code' },
    request: new Request('http://local/api/amap-config'),
    params: {},
  });

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    key: 'js-key',
    securityJsCode: 'security-code',
  });
});

await test('GET /api/amap-config rejects missing browser AMap JS key', async () => {
  const res = await onRequestGet({
    env: {},
    request: new Request('http://local/api/amap-config'),
    params: {},
  });

  assert.equal(res.status, 500);
  assert.match(await res.text(), /amap_js_key_missing/);
});
