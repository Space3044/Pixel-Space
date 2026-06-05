import assert from 'node:assert/strict';
import {
  parseJsonObject,
  normalizeOptionalString,
  normalizeStringList,
} from '../functions/_shared/request.ts';

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

await test('parseJsonObject returns only plain JSON objects', async () => {
  assert.deepEqual(
    await parseJsonObject(new Request('http://localhost', { method: 'POST', body: '{"keys":[" a "]}' })),
    { keys: [' a '] },
  );
  assert.equal(
    await parseJsonObject(new Request('http://localhost', { method: 'POST', body: '[]' })),
    null,
  );
  assert.equal(
    await parseJsonObject(new Request('http://localhost', { method: 'POST', body: 'not-json' })),
    null,
  );
});

await test('normalizeStringList trims values and rejects invalid batch input', async () => {
  assert.deepEqual(normalizeStringList([' a ', 'b'], { min: 1, max: 2 }), ['a', 'b']);
  assert.equal(normalizeStringList([], { min: 1, max: 2 }), null);
  assert.equal(normalizeStringList(['a', 'b', 'c'], { min: 1, max: 2 }), null);
  assert.equal(normalizeStringList(['a', 1], { min: 1, max: 2 }), null);
  assert.equal(normalizeStringList([''], { min: 1, max: 2 }), null);
});

await test('normalizeOptionalString distinguishes invalid values from empty strings', async () => {
  assert.equal(normalizeOptionalString(null), null);
  assert.equal(normalizeOptionalString(undefined), null);
  assert.equal(normalizeOptionalString(''), null);
  assert.equal(normalizeOptionalString(' folder-id '), 'folder-id');
  assert.equal(normalizeOptionalString(123), undefined);
});
