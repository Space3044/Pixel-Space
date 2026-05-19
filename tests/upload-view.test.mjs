import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const view = readFileSync('src/features/upload/UploadView.vue', 'utf8');
const plan = readFileSync('docs/PLAN.md', 'utf8');

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const extract = (start, end) => {
  const startIndex = view.indexOf(start);
  assert.notEqual(startIndex, -1, `missing start marker: ${start}`);
  const endIndex = view.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `missing end marker: ${end}`);
  return view.slice(startIndex, endIndex);
};

test('upload page removes the redundant hero copy block', () => {
  assert.doesNotMatch(view, /class="hero-left"/);
  assert.doesNotMatch(view, /\.hero-(eyebrow|title|sub)\b/);
});

test('upload queue count uses a compact status label instead of raw zero count', () => {
  assert.match(view, /queueCountLabel/);
  assert.doesNotMatch(view, /\{\{\s*hasFile\s*\?\s*'1'\s*:\s*'0'\s*\}\}\s*张/);
});

test('upload queue rail is wide enough and does not scroll on desktop', () => {
  assert.match(view, /grid-template-columns:\s*8rem minmax\(0,\s*1fr\) 24rem/);

  const desktopQueueList = extract('@media (min-width: 1024px) {\n  .queue-list', '\n  }\n}\n\n.thumb-cell');
  assert.doesNotMatch(desktopQueueList, /overflow-y:\s*auto/);
  assert.doesNotMatch(desktopQueueList, /max-height:/);
});

test('upload map can place a marker before a file is selected', () => {
  const clickHandler = extract("map.on('click'", '  });\n  updateMapMarker(false);');
  assert.doesNotMatch(clickHandler, /selectedFile\.value/);

  const mapBlock = extract('<div class="map-block">', '            </section>\n          </aside>');
  assert.doesNotMatch(mapBlock, /:disabled="!hasFile"/);
});

test('upload page avoids oversized rounded corners', () => {
  const oversizedRadius = /border-radius:\s*(?:0\.8[0-9]*rem|[1-9]\d*(?:\.\d+)?rem|9999px|999px)/;
  assert.doesNotMatch(view, oversizedRadius);
  assert.match(view, /\.upload-page\s+\.cyber-input/);
  assert.match(view, /\.upload-page\s+\.cyber-button/);
});

test('upload page removes the floating hero status block', () => {
  assert.doesNotMatch(view, /class="page-hero"/);
  assert.doesNotMatch(view, /class="hero-status"/);
  assert.doesNotMatch(view, /\.page-hero|\.hero-status|\.status-dot/);
});

test('upload drop zone centers its content', () => {
  const dropZoneBlock = extract('.drop-zone {', '\n}\n.drop-zone:hover');
  assert.match(dropZoneBlock, /justify-content:\s*center/);
  assert.match(dropZoneBlock, /text-align:\s*center/);
});

test('upload page defers progress UI to a later shared component', () => {
  assert.doesNotMatch(view, /compressionProgress|onProgress|压缩进度|压缩中\s*\{\{/);
  assert.match(plan, /统一进度条组件/);
});

test('upload footer uses an upload action label instead of debug FormData copy', () => {
  assert.match(view, /上传图片/);
  assert.doesNotMatch(view, /打印 FormData|FormData 已打印到控制台/);
});

test('upload page calls the real upload API instead of console-only FormData logging', () => {
  assert.match(view, /import\s+\{\s*uploadImage\s*\}\s+from\s+'\.\/upload\.api'/);
  assert.match(view, /await\s+uploadImage\(formData\)/);
  assert.doesNotMatch(view, /console\.group|console\.log|console\.groupEnd/);
});

test('upload page stays on the upload screen and shows share actions after success', () => {
  assert.doesNotMatch(view, /useRouter|router\.push/);
  assert.match(view, /uploadResult\s*=\s*ref/);
  assert.match(view, /uploadResult\.value\s*=\s*record/);
  assert.match(view, /class="upload-result/);
  assert.match(view, /查看公开页/);
  assert.match(view, /继续上传/);
  assert.match(view, /复制/);
  assert.match(view, /buildMarkdown|buildHtml|buildPublicPageUrl/);
});

test('upload page submits compressed image dimensions with the form data', () => {
  assert.match(view, /compressedDimensions\s*=\s*ref/);
  assert.match(view, /readImageDimensions\(nextCompressed\)/);
  assert.match(view, /const\s+dimensions\s*=\s*compressedDimensions\.value/);
  assert.match(view, /\bdimensions,/);
});

test('upload exif date and camera each span a full row', () => {
  assert.match(view, /<div class="meta-row exif-row-wide">\s*<dt>拍摄时间<\/dt>/);
  assert.match(view, /<div class="meta-row exif-row-wide">\s*<dt>相机<\/dt>/);

  const styleBlock = extract('.exif-row-wide {', '\n}\n\n.meta-row');
  assert.match(styleBlock, /grid-column:\s*1\s*\/\s*-1/);
});
