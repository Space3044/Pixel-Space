import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const index = readFileSync('index.html', 'utf8');
const manifestPath = 'public/site.webmanifest';

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('index.html declares site icons and manifest assets', () => {
  assert.match(index, /<link rel="icon" href="\/favicon\.ico" sizes="any" \/>/);
  assert.match(index, /<link rel="icon" type="image\/png" sizes="32x32" href="\/favicon-32x32\.png" \/>/);
  assert.match(index, /<link rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png" \/>/);
  assert.match(index, /<link rel="manifest" href="\/site\.webmanifest" \/>/);

  for (const path of [
    'public/favicon.ico',
    'public/favicon-16x16.png',
    'public/favicon-32x32.png',
    'public/apple-touch-icon.png',
    'public/icon-192.png',
    'public/icon-512.png',
    manifestPath,
  ]) {
    assert.equal(existsSync(path), true, `${path} should exist`);
  }
});

test('index.html exposes SEO and social preview metadata', () => {
  assert.match(index, /<title>Pixel Space \| 个人图床与影像归档<\/title>/);
  assert.match(index, /<meta name="application-name" content="Pixel Space" \/>/);
  assert.match(index, /<meta name="description" content="Pixel Space 是个人图床与影像归档空间，支持 WebP 压缩、公开图库、原图归档、AI 描述标签、地图足迹和分享页。" \/>/);
  assert.match(index, /<meta name="keywords" content="Pixel Space, 个人图床, 图片归档, WebP 压缩, AI 图片描述, 地图足迹" \/>/);
  assert.match(index, /<meta property="og:title" content="Pixel Space \| 个人图床与影像归档" \/>/);
  assert.match(index, /<meta property="og:image" content="\/icon-512\.png" \/>/);
  assert.match(index, /<meta name="twitter:image" content="\/icon-512\.png" \/>/);
  assert.match(index, /<meta name="twitter:image:alt" content="Pixel Space 霓虹相机图标" \/>/);
});

test('site.webmanifest describes the generated icon set', () => {
  assert.equal(existsSync(manifestPath), true);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.name, 'Pixel Space');
  assert.equal(manifest.short_name, 'Pixel Space');
  assert.equal(manifest.description, '个人图床与影像归档空间');
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ['192x192', '512x512']);
  assert.ok(manifest.icons.every((icon) => icon.type === 'image/png'));
});
