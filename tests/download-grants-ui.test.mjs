import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const accessView = readFileSync('src/features/access/AccessView.vue', 'utf8');
const accessApi = readFileSync('src/features/access/access.api.ts', 'utf8');
const router = readFileSync('src/app/router.ts', 'utf8');

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('access.api verifies codes and downloads originals without putting code in the URL', () => {
  assert.match(accessApi, /export interface VerifyDownloadGrantResponse/);
  assert.match(accessApi, /export function verifyDownloadGrant\(code: string\)/);
  assert.match(accessApi, /'\/api\/download-grants\/verify'/);
  assert.match(accessApi, /method:\s*'POST'/);
  assert.match(accessApi, /body:\s*JSON\.stringify\(\{\s*code\s*\}\)/);
  assert.match(accessApi, /export async function downloadGrantOriginal\(key: string, code: string\)/);
  assert.match(accessApi, /`\/api\/download-grants\/original\/\$\{encodeURIComponent\(key\)\}`/);
  assert.doesNotMatch(accessApi, /code=.*URLSearchParams|searchParams\.set\('code'/);
});

test('AccessView renders code entry authorized images and original download actions', () => {
  assert.match(accessView, /verifyDownloadGrant/);
  assert.match(accessView, /downloadGrantOriginal/);
  assert.match(accessView, /const code = ref\(''\)/);
  assert.match(accessView, /@submit\.prevent="submitCode"/);
  assert.match(accessView, /placeholder="输入验证码"/);
  assert.match(accessView, /v-for="image in images"/);
  assert.match(accessView, /image\.original_filename \|\| image\.title \|\| image\.key/);
  assert.match(accessView, /@click="downloadOriginal\(image\)"/);
  assert.match(accessView, /const batchDownloading = ref\(false\)/);
  assert.match(accessView, /const downloadAllOriginals = async \(\) =>/);
  assert.match(accessView, /for \(const image of images\.value\)/);
  assert.match(accessView, /@click="downloadAllOriginals"/);
  assert.match(accessView, /批量下载原图/);
  assert.match(accessView, /URL\.createObjectURL/);
  assert.match(accessView, /URL\.revokeObjectURL/);
  assert.match(accessView, /验证码无效或已过期/);
});

test('router exposes public access page', () => {
  assert.match(router, /path:\s*'\/access'[\s\S]*name:\s*'access'[\s\S]*AccessView\.vue/);
  assert.match(router, /path:\s*'\/access'[\s\S]*title:\s*'原图通行'/);
  assert.doesNotMatch(router, /path:\s*'\/access'[\s\S]*requiresAdmin:\s*true/);
});
