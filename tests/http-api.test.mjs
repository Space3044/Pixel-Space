import assert from 'node:assert/strict';
import { fetchJson, readHttpError } from '../src/shared/api/http.ts';

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

await test('readHttpError reads structured API error once', async () => {
  const response = Response.json({ error: 'invalid_image_mime' }, { status: 400 });
  assert.equal(await readHttpError(response), 'invalid_image_mime');
});

await test('readHttpError keeps plain text API errors', async () => {
  const response = new Response('upstream unavailable', { status: 503 });
  assert.equal(await readHttpError(response), 'upstream unavailable');
});

await test('fetchJson centralizes frontend JSON error handling', async () => {
  await withMockedFetch(
    async () => Response.json({ message: 'not allowed' }, { status: 403 }),
    async () => {
      await assert.rejects(
        () => fetchJson('/api/example'),
        /\/api\/example failed: not allowed/,
      );
    },
  );
});
