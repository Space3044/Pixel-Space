import assert from 'node:assert/strict';
import { onRequestGet as publicObjectGet } from '../functions/api/public/[key].ts';

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const makeEnv = (object) => ({
  BUCKET: {
    get: async (key) => (key === 'cat-key' ? object : null),
  },
});

await test('GET /api/public/:key streams the compressed R2 object for local display', async () => {
  const env = makeEnv({
    body: new Blob(['webp-bytes'], { type: 'image/webp' }).stream(),
    httpEtag: '"etag-cat"',
    writeHttpMetadata(headers) {
      headers.set('content-type', 'image/webp');
    },
  });

  const response = await publicObjectGet({
    env,
    params: { key: 'cat-key' },
    request: new Request('http://x/api/public/cat-key'),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/webp');
  assert.equal(response.headers.get('etag'), '"etag-cat"');
  assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal(await response.text(), 'webp-bytes');
});

await test('GET /api/public/:key returns 404 when R2 object is missing', async () => {
  const response = await publicObjectGet({
    env: makeEnv(null),
    params: { key: 'missing' },
    request: new Request('http://x/api/public/missing'),
  });

  assert.equal(response.status, 404);
});
