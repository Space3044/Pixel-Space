import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('LoginView presents Access OTP instead of GitHub identity copy', () => {
  const source = read('src/features/auth/LoginView.vue');

  assert.match(source, /邮箱验证码登录/);
  assert.match(source, /OTP/);
  assert.doesNotMatch(source, /GitHub/);
  assert.doesNotMatch(source, /const GITHUB/);
});

test('AccessView reuses the shared download grant expiry formatter', () => {
  const source = read('src/features/access/AccessView.vue');

  assert.match(source, /formatDownloadGrantExpiry/);
  assert.doesNotMatch(source, /new Intl\.DateTimeFormat/);
});
