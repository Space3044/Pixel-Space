import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const view = readFileSync('src/features/random/RandomView.vue', 'utf8');

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('RandomView uses real image records instead of placeholder content', () => {
  assert.match(view, /import\s+\{\s*listImages\s*\}\s+from\s+'@\/features\/images\/images\.api'/);
  assert.match(view, /type\s+\{\s*ImageRecord\s*\}/);
  assert.match(view, /image\s*=\s*ref<ImageRecord\s*\|\s*null>/);
  assert.match(view, /image\.public_url/);
  assert.doesNotMatch(view, /作者信息待|待阶段|随机推荐图片占位|Uploader/);
});

test('RandomView detail cards are file detail, ai analysis, and copyable links', () => {
  assert.match(view, />File Detail</);
  assert.match(view, />AI Analysis</);
  assert.match(view, />Copy Links</);
  assert.match(view, /buildImageLinkRows/);
  assert.match(view, /buildImageLinkRows\(current,\s*origin\)/);
  assert.match(view, /copyLink/);
  assert.match(view, /useClipboardFeedback/);
  assert.doesNotMatch(view, /navigator\.clipboard\.writeText/);
});

test('RandomView exposes image metadata and ai fields', () => {
  assert.match(view, /from '@\/features\/images\/image-meta'/);
  assert.match(view, /exif_iso/);
  assert.match(view, /exif_aperture/);
  assert.match(view, /exif_shutter/);
  assert.match(view, /exif_focal_length/);
  assert.match(view, /location_lat/);
  assert.match(view, /location_lng/);
  assert.match(view, /caption/);
  assert.match(view, /dominant_color/);
  assert.match(view, /composition/);
  assert.match(view, /aiPalette/);
  assert.match(view, /tagsFromImage\(image\.value\)/);
  assert.match(view, /paletteFromImage\(image\.value\)/);
  assert.match(view, /parseDominantColor/);
  assert.doesNotMatch(view, /const tagsFromImage = /);
  assert.doesNotMatch(view, /const paletteFromImage = /);
  assert.doesNotMatch(view, /const parseDominantColor = /);
  assert.match(view, /const dominantColor = computed/);
  assert.match(view, /class="dominant-color-value"/);
  assert.match(view, /class="palette-chip dominant-color-chip"/);
  assert.match(view, /:title="dominantColor\.hex \|\| image\.dominant_color"/);
  assert.match(view, /class="ai-visual-item is-inline"/);
  assert.match(view, /class="ai-visual-item is-inline is-palette"/);
  assert.doesNotMatch(view, /<div class="ai-visual-item is-wide">\s*<span>色板<\/span>/s);
  assert.match(view, /\.palette-list\s*\{[^}]*flex-wrap:\s*nowrap;[^}]*overflow-x:\s*auto;/s);
  assert.match(view, /\.palette-chip\s*\{[^}]*display:\s*inline-block;[^}]*width:\s*20px;[^}]*height:\s*20px;/s);
  assert.match(view, /\.dominant-color-chip\s*\{[^}]*width:\s*20px;[^}]*height:\s*20px;/s);
  assert.match(view, /\.ai-visual-item\s*>\s*\.dominant-color-value\s*\{[^}]*display:\s*inline-flex;/s);
  assert.match(view, /\.ai-visual-item\.is-inline\s*\{[^}]*display:\s*flex;[^}]*white-space:\s*nowrap;/s);
  assert.doesNotMatch(view, /AI\s*\{\{\s*image\.ai_status\s*\}\}/);
});

test('RandomView file detail keeps selected fields and renders a location map', () => {
  assert.match(view, /import ReadOnlyMap from '@\/features\/images\/ReadOnlyMap\.vue'/);
  assert.match(view, /<ReadOnlyMap/);
  assert.match(view, /:lat="image\.location_lat"/);
  assert.match(view, /:lng="image\.location_lng"/);
  assert.match(view, /const locationName = computed/);
  assert.match(view, /\{\{ locationName \}\}/);
  assert.match(view, />位置<\/span>/);
  assert.match(view, /\.detail-list\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/s);
  assert.doesNotMatch(view, /\.detail-row:first-child/);
  assert.match(view, /label:\s*'快门'/);
  assert.match(view, /label:\s*'ISO'/);
  assert.match(view, /label:\s*'光圈'/);
  assert.match(view, /label:\s*'焦距'/);
  assert.doesNotMatch(view, /label:\s*'文件名'/);
  assert.doesNotMatch(view, /label:\s*'尺寸'/);
  assert.doesNotMatch(view, /label:\s*'大小'/);
  assert.doesNotMatch(view, /label:\s*'格式'/);
  assert.doesNotMatch(view, /label:\s*'相机'/);
  assert.doesNotMatch(view, /label:\s*'拍摄时间'/);
  assert.doesNotMatch(view, /formatBytes|formatExifTakenAt|formatLocation|formatCoordinate|hasLocation/);
});

test('RandomView keeps the hero image below the nav and preserves image ratio', () => {
  assert.match(view, /class="random-hero"/);
  assert.match(view, /class="random-image-frame cyber-panel"/);
  assert.match(view, /class="random-main-image"/);
  assert.doesNotMatch(view, /-mt-16|h-screen|pb-24|object-cover/);
  assert.match(view, /height:\s*calc\(100(?:svh|vh)\s*-\s*4rem\)/);
  assert.match(view, /object-fit:\s*contain/);
});

test('RandomView uses a structured detail layout without duplicate hero copy', () => {
  assert.match(view, /class="random-details-section"/);
  assert.match(view, /class="random-detail-grid"/);
  assert.match(view, /class="detail-list"/);
  assert.doesNotMatch(view, /tracking-\[0\.34em\] text-neon-cyan">Random|{{ image\.title }}\s*<\/h1>|{{ image\.caption }}/);
});
