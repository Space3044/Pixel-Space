import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const view = readFileSync('src/features/upload/UploadView.vue', 'utf8').replace(/\r\n/g, '\n');
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

test('upload queue rail is wide enough and scrolls inside the fixed workbench on desktop', () => {
  assert.match(view, /grid-template-columns:\s*8\.5rem minmax\(0,\s*1fr\) 24rem/);
  assert.match(view, /height:\s*clamp\(32rem,\s*calc\(100svh - 13rem\),\s*46rem\)/);

  const desktopQueueList = extract('@media (min-width: 1024px) {\n  .queue-list', '\n  }\n}\n\n.thumb-cell');
  assert.match(desktopQueueList, /overflow-y:\s*auto/);
  assert.match(desktopQueueList, /min-height:\s*0/);
  assert.doesNotMatch(desktopQueueList, /max-height:/);
});

test('upload workbench keeps the preview fixed while side panels scroll with styled scrollbars', () => {
  const desktopWorkbench = extract('@media (min-width: 1024px) {\n  .workbench', '\n  }\n}\n\n.queue-rail');
  assert.match(desktopWorkbench, /height:\s*clamp\(32rem,\s*calc\(100svh - 13rem\),\s*46rem\)/);

  const desktopPreview = extract('@media (min-width: 1024px) {\n  .preview-stage', '\n  }\n}\n\n.meta-sidebar');
  assert.match(desktopPreview, /height:\s*100%/);
  assert.match(desktopPreview, /min-height:\s*0/);

  const metaSidebar = extract('.meta-sidebar {', '\n}\n\n.meta-section');
  assert.match(metaSidebar, /overflow-y:\s*auto/);
  assert.match(metaSidebar, /min-height:\s*0/);

  assert.match(view, /\.queue-list,\n\.meta-sidebar\s*\{\n[\s\S]*scrollbar-width:\s*thin/);
  assert.match(view, /\.queue-list::-webkit-scrollbar-thumb,\n\.meta-sidebar::-webkit-scrollbar-thumb/);
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

test('upload page stays on the upload screen and stores results on each queue entry', () => {
  assert.doesNotMatch(view, /useRouter|router\.push/);
  assert.match(view, /uploadResult:\s*ImageRecord\s*\|\s*null/);
  assert.match(view, /entry\.uploadResult\s*=\s*record/);
  assert.match(view, /entry\.uploadResult\s*=\s*existing/);
  assert.match(view, /doneEntries\s*=\s*computed/);
});

test('upload page submits compressed image dimensions with the form data', () => {
  assert.match(view, /readImageDimensions\(nextCompressed\)/);
  assert.match(view, /entry\.compressedDimensions\s*=\s*nextDimensions/);
  assert.match(view, /buildUploadFormData\(\{\s*original:\s*entry\.file,[\s\S]*dimensions:\s*entry\.compressedDimensions,/);
});

test('upload page runs AI preview after compression and keeps fields editable', () => {
  assert.match(view, /import\s+\{\s*previewAiAnnotation\s*\}\s+from\s+'\.\/ai-preview\.api'/);
  assert.match(view, /aiRequestId:\s*number/);
  assert.match(view, /const\s+runAiPreview\s*=\s*async\s*\(entry:\s*UploadEntry\)/);
  assert.match(view, /const\s+requestId\s*=\s*\+\+entry\.aiRequestId/);
  assert.match(view, /enqueueAi\(entry\)/);
  assert.match(view, /triggerAiForCurrent/);
  assert.match(view, /重新 AI 分析/);
  assert.match(view, /v-model="displayEntry\.meta\.tags"/);
  assert.match(view, /v-model="displayEntry\.meta\.search_content"/);
  assert.match(view, /v-model="displayEntry\.meta\.dominant_color"/);
  assert.match(view, /v-model="displayEntry\.meta\.palette"/);
  assert.match(view, /v-model="displayEntry\.meta\.composition"/);
  assert.match(view, /entry\.meta\.dominant_color\s*=\s*result\.dominant_color/);
  assert.match(view, /entry\.meta\.palette\s*=\s*result\.palette\.join\(', '\)/);
  assert.match(view, /entry\.meta\.composition\s*=\s*result\.composition/);
  assert.doesNotMatch(view, /v-model="meta\.ocr_text"/);
  assert.doesNotMatch(view, /<span class="field-label">OCR<\/span>/);
  assert.match(view, /entry\.meta\.ai_status\s*=\s*'done'/);
});

test('upload duplicate check failure is not silently treated as a new image', () => {
  assert.doesNotMatch(view, /checkImageHash\(hash\)\.catch\(\(\)\s*=>\s*null\)/);
  assert.match(view, /const existing = await checkImageHash\(hash\)/);
});

test('upload folder loading errors are visible instead of silently falling back', () => {
  assert.match(view, /globalError\.value = `文件夹加载失败：\$\{\(error as Error\)\.message\}`/);
  assert.doesNotMatch(view, /拉不到不阻塞上传/);
});

test('upload exif date and camera each span a full row', () => {
  assert.match(view, /<div class="meta-row exif-row-wide">\s*<dt>拍摄时间<\/dt>/);
  assert.match(view, /<div class="meta-row exif-row-wide">\s*<dt>相机<\/dt>/);

  const styleBlock = extract('.exif-row-wide {', '\n}\n\n.meta-row');
  assert.match(styleBlock, /grid-column:\s*1\s*\/\s*-1/);
});
