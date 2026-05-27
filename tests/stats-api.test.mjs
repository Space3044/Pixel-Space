import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('functions/api/stats.ts', 'utf8');

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('GET /api/stats only returns fields used by the home page', () => {
  assert.match(source, /photos:\s*summary\?\.photos \?\? 0/);
  assert.match(source, /storage_bytes:\s*summary\?\.storage_bytes \?\? 0/);
  assert.match(source, /places:\s*summary\?\.places \?\? 0/);
  assert.match(source, /latest:\s*latestRecords/);
  assert.doesNotMatch(source, /ai_tagged|ai_status = 'ok'/);
});
