import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const view = readFileSync('src/features/upload/UploadView.vue', 'utf8').replace(/\r\n/g, '\n');
const selectionPath = 'src/features/upload/useUploadFileSelection.ts';
const selection = existsSync(selectionPath) ? readFileSync(selectionPath, 'utf8').replace(/\r\n/g, '\n') : '';

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('upload file selection lives outside the page component', () => {
  assert.equal(existsSync(selectionPath), true, `${selectionPath} should exist`);
  assert.match(view, /import \{ useUploadFileSelection \} from '\.\/useUploadFileSelection'/);
  assert.match(view, /useUploadFileSelection\(\{/);

  for (const localSymbol of [
    'releaseEntryPreview',
    'addFiles',
    'handleInputChange',
    'handleDrop',
    'openFilePicker',
    'selectEntry',
    'removeEntry',
    'clearAll',
  ]) {
    assert.doesNotMatch(view, new RegExp(`const\\s+${localSymbol}\\s*=`), `${localSymbol} should not be local to UploadView`);
    assert.match(selection, new RegExp(`const\\s+${localSymbol}\\s*=`), `${localSymbol} should move into useUploadFileSelection`);
  }
});

test('upload file selection owns file validation and preview cleanup', () => {
  assert.match(selection, /const\s+MAX_ORIGINAL_BYTES\s*=\s*50\s*\*\s*1024\s*\*\s*1024/);
  assert.match(selection, /!file\.type\.startsWith\('image\/'\)/);
  assert.match(selection, /file\.size > MAX_ORIGINAL_BYTES/);
  assert.match(selection, /URL\.revokeObjectURL\(entry\.previewObjectUrl\)/);
  assert.match(selection, /for \(const entry of accepted\) enqueueProcess\(entry\)/);
  assert.match(selection, /void syncPickRegionFromEntry\(nextEntry\)/);
  assert.match(selection, /const releaseAllEntryPreviews = \(\) =>/);

  assert.doesNotMatch(view, /MAX_ORIGINAL_BYTES/);
  assert.match(view, /releaseAllEntryPreviews\(\)/);
});
