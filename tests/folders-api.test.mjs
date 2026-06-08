import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequestGet } from '../functions/api/folders.ts';
import * as folderShared from '../functions/_shared/folders.ts';

const publicFoldersApi = readFileSync('functions/api/folders.ts', 'utf8');
const adminFoldersApi = readFileSync('functions/api/admin/folders/index.ts', 'utf8');

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

await test('public folder SQL only returns branches that contain public images', () => {
  const sql = folderShared.LIST_PUBLIC_FOLDERS_SQL;

  assert.equal(typeof sql, 'string');
  assert.match(sql, /WITH RECURSIVE/i);
  assert.match(sql, /WHERE folder_id IS NOT NULL\s+AND is_public = 1/i);
  assert.match(sql, /JOIN visible_folders vf ON vf\.id = f\.id/i);
  assert.match(sql, /id IN \(SELECT id FROM visible_folders\)/i);
  assert.match(sql, /COALESCE\(image_counts\.image_count, 0\) AS image_count/i);
});

await test('public and admin folder APIs use separate folder list queries', () => {
  assert.match(publicFoldersApi, /LIST_PUBLIC_FOLDERS_SQL/);
  assert.doesNotMatch(publicFoldersApi, /env\.DB\.prepare\(LIST_FOLDERS_SQL\)/);
  assert.match(adminFoldersApi, /env\.DB\.prepare\(LIST_FOLDERS_SQL\)/);
  assert.doesNotMatch(adminFoldersApi, /LIST_PUBLIC_FOLDERS_SQL/);
});

await test('GET /api/folders executes the public folder query', async () => {
  let preparedSql = '';
  const rows = [
    {
      id: 'travel',
      parent_id: null,
      name: '旅行',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      image_count: 0,
      child_count: 1,
    },
    {
      id: 'paris',
      parent_id: 'travel',
      name: '巴黎',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      image_count: 2,
      child_count: 0,
    },
  ];
  const env = {
    DB: {
      prepare(sql) {
        preparedSql = sql;
        return {
          async all() {
            return { results: rows };
          },
        };
      },
    },
  };

  const response = await onRequestGet({
    env,
    params: {},
    request: new Request('http://localhost/api/folders'),
  });

  assert.equal(response.status, 200);
  assert.equal(preparedSql, folderShared.LIST_PUBLIC_FOLDERS_SQL);
  assert.deepEqual(await response.json(), { folders: rows });
});
