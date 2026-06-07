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

test('LoginView uses a document navigation link for the Access protected console', () => {
  const source = read('src/features/auth/LoginView.vue');

  assert.match(source, /<a\s+href="\/library"\s+class="primary">/);
  assert.match(source, /:\s*'\/library'/);
  assert.doesNotMatch(source, /<RouterLink\s+to="\/library"\s+class="primary">/);
  assert.doesNotMatch(source, /<a\s+href="\/upload"\s+class="primary">/);
});

test('AccessView reuses the shared download grant expiry formatter', () => {
  const source = read('src/features/access/AccessView.vue');

  assert.match(source, /formatDownloadGrantExpiry/);
  assert.doesNotMatch(source, /new Intl\.DateTimeFormat/);
});

test('AccessView reuses the same ImageLightbox viewer as Explore for large previews', () => {
  const source = read('src/features/access/AccessView.vue');

  assert.match(source, /defineAsyncComponent/);
  assert.match(source, /const ImageLightbox = defineAsyncComponent\(\(\) => import\('@\/features\/images\/ImageLightbox\.vue'\)\)/);
  assert.match(source, /const lightboxOpen = ref\(false\)/);
  assert.match(source, /const lightboxImage = ref<ImageRecord \| null>\(null\)/);
  assert.match(source, /const openLightbox = \(image: ImageRecord\) => \{/);
  assert.match(source, /@click="openLightbox\(image\)"/);
  assert.match(source, /<ImageLightbox[\s\S]*:open="lightboxOpen"[\s\S]*:image="lightboxImage"[\s\S]*@close="lightboxOpen = false"/);
  assert.doesNotMatch(source, /access-preview-backdrop|access-preview-dialog|access-preview-image/);
});
