import assert from 'node:assert/strict';
import { onRequestGet as publicObjectGet } from '../functions/api/public/[[key]].ts';
import { onRequestGet as adminObjectGet } from '../functions/api/admin/public/[[key]].ts';

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const makeEnv = (object, { isPublic = 1 } = {}) => {
  const calls = {
    r2Gets: [],
  };
  const env = {
    BUCKET: {
      get: async (key) => {
        calls.r2Gets.push(key);
        return key === 'images/cat-key' ? object : null;
      },
    },
    DB: {
      prepare() {
        return {
          bind() {
            return {
              first: async () => ({ key: 'images/cat-key', is_public: isPublic }),
            };
          },
        };
      },
    },
  };
  return { env, calls };
};

await test('GET /api/public/*key streams the compressed R2 object for local display', async () => {
  const { env } = makeEnv({
    body: new Blob(['webp-bytes'], { type: 'image/webp' }).stream(),
    httpEtag: '"etag-cat"',
    writeHttpMetadata(headers) {
      headers.set('content-type', 'image/webp');
    },
  });

  const response = await publicObjectGet({
    env,
    params: { key: ['images', 'cat-key'] },
    request: new Request('http://x/api/public/images/cat-key'),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/webp');
  assert.equal(response.headers.get('etag'), '"etag-cat"');
  assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal(await response.text(), 'webp-bytes');
});

await test('GET /api/public/*key returns 404 when R2 object is missing', async () => {
  const response = await publicObjectGet({
    env: makeEnv(null).env,
    params: { key: ['images', 'missing'] },
    request: new Request('http://x/api/public/images/missing'),
  });

  assert.equal(response.status, 404);
});

await test('GET /api/public/*key does not stream private image objects to visitors', async () => {
  const { env, calls } = makeEnv({
    body: new Blob(['private-webp'], { type: 'image/webp' }).stream(),
    httpEtag: '"etag-private"',
    writeHttpMetadata(headers) {
      headers.set('content-type', 'image/webp');
    },
  }, { isPublic: 0 });

  const response = await publicObjectGet({
    env,
    params: { key: ['images', 'cat-key'] },
    request: new Request('https://imgbed.example.com/api/public/images/cat-key'),
  });

  assert.equal(response.status, 404);
  assert.deepEqual(calls.r2Gets, []);
});

await test('GET /api/public/*key stays visitor-scoped on localhost public route', async () => {
  const { env, calls } = makeEnv({
    body: new Blob(['private-webp'], { type: 'image/webp' }).stream(),
    httpEtag: '"etag-private"',
    writeHttpMetadata(headers) {
      headers.set('content-type', 'image/webp');
    },
  }, { isPublic: 0 });

  const response = await publicObjectGet({
    env,
    params: { key: ['images', 'cat-key'] },
    request: new Request('http://localhost/api/public/images/cat-key'),
  });

  assert.equal(response.status, 404);
  assert.deepEqual(calls.r2Gets, []);
});

await test('GET /api/admin/public/*key streams private image objects for admins', async () => {
  const { env, calls } = makeEnv({
    body: new Blob(['private-webp'], { type: 'image/webp' }).stream(),
    httpEtag: '"etag-private"',
    writeHttpMetadata(headers) {
      headers.set('content-type', 'image/webp');
    },
  }, { isPublic: 0 });

  const response = await adminObjectGet({
    env,
    params: { key: ['images', 'cat-key'] },
    request: new Request('http://localhost/api/admin/public/images/cat-key'),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(calls.r2Gets, ['images/cat-key']);
  assert.equal(response.headers.get('content-type'), 'image/webp');
  assert.equal(await response.text(), 'private-webp');
});
