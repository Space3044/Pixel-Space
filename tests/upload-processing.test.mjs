import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const view = readFileSync('src/features/upload/UploadView.vue', 'utf8').replace(/\r\n/g, '\n');
const processingPath = 'src/features/upload/useUploadProcessing.ts';
const processing = existsSync(processingPath) ? readFileSync(processingPath, 'utf8').replace(/\r\n/g, '\n') : '';

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('upload processing lives outside the page component', () => {
  assert.equal(existsSync(processingPath), true, `${processingPath} should exist`);
  assert.match(view, /import \{ useUploadProcessing \} from '\.\/useUploadProcessing'/);
  assert.match(view, /useUploadProcessing\(\{/);

  for (const localSymbol of [
    'readExif',
    'compressToWebp',
    'prepareAiPreviewFile',
    'sha256HexFromFile',
    'readImageDimensions',
    'watchTelegramArchive',
    'runAiPreview',
    'processEntry',
    'uploadEntry',
    'runConcurrentEntries',
  ]) {
    assert.doesNotMatch(view, new RegExp(`const\\s+${localSymbol}\\s*=`), `${localSymbol} should not be local to UploadView`);
    assert.match(processing, new RegExp(`const\\s+${localSymbol}\\s*=`), `${localSymbol} should move into useUploadProcessing`);
  }
});

test('upload processing owns external upload side effects', () => {
  assert.match(processing, /import imageCompression from 'browser-image-compression'/);
  assert.match(processing, /import exifr from 'exifr'/);
  assert.match(processing, /previewAiAnnotation\(aiImage\)/);
  assert.match(processing, /uploadImage\(formData\)/);
  assert.match(processing, /retryTelegramArchive\(entry\.uploadResult\.key,\s*entry\.file\)/);
  assert.match(processing, /fetchAdminImage\(key\)/);
  assert.match(processing, /checkAdminImageHash\(hash\)/);

  assert.doesNotMatch(view, /from 'browser-image-compression'/);
  assert.doesNotMatch(view, /from 'exifr'/);
  assert.doesNotMatch(view, /previewAiAnnotation|uploadImage|retryTelegramArchive|fetchAdminImage|checkAdminImageHash/);
});

test('upload processing keeps concurrency limits with the workflow', () => {
  assert.match(processing, /const\s+PROCESS_CONCURRENCY\s*=\s*2/);
  assert.match(processing, /const\s+AI_CONCURRENCY\s*=\s*2/);
  assert.match(processing, /const\s+UPLOAD_CONCURRENCY\s*=\s*2/);
  assert.match(processing, /processWorkers\s*<\s*PROCESS_CONCURRENCY/);
  assert.match(processing, /aiWorkers\s*<\s*AI_CONCURRENCY/);
  assert.match(processing, /runConcurrentEntries\(uploadCandidates,\s*UPLOAD_CONCURRENCY,\s*uploadEntry\)/);
});
