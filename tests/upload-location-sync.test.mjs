import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const view = readFileSync('src/features/upload/UploadView.vue', 'utf8').replace(/\r\n/g, '\n');
const syncPath = 'src/features/upload/useUploadLocationSync.ts';
const sync = existsSync(syncPath) ? readFileSync(syncPath, 'utf8').replace(/\r\n/g, '\n') : '';

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('upload location sync lives outside the page component', () => {
  assert.equal(existsSync(syncPath), true, `${syncPath} should exist`);
  assert.match(view, /import \{ useUploadLocationSync \} from '\.\/useUploadLocationSync'/);
  assert.match(view, /useUploadLocationSync\(\{/);

  for (const localSymbol of [
    'broadcastLocationInto',
    'broadcastLocationToAll',
    'updateLat',
    'updateLng',
    'clearLocation',
    'setIsPublic',
    'setLocationPublic',
    'applyLocationSearchResult',
  ]) {
    assert.doesNotMatch(view, new RegExp(`const\\s+${localSymbol}\\s*=`), `${localSymbol} should not be local to UploadView`);
    assert.match(sync, new RegExp(`const\\s+${localSymbol}\\s*=`), `${localSymbol} should move into useUploadLocationSync`);
  }
});

test('upload location sync owns coordinate watchers and non-destructive broadcast rules', () => {
  assert.match(sync, /const syncLocation = ref<boolean>\(false\)/);
  assert.match(sync, /if \(!syncLocation\.value\) return/);
  assert.match(sync, /if \(target\.meta\.location_lat !== null && target\.meta\.location_lng !== null\) return/);
  assert.match(sync, /if \(!target\.meta\.location_name\) target\.meta\.location_name = cur\.meta\.location_name/);
  assert.match(sync, /watch\(\s*\(\) => currentEntry\.value\?\.meta\.location_lat/);
  assert.match(sync, /watch\(syncLocation, \(val\) => \{/);

  assert.doesNotMatch(view, /watch\(syncLocation, \(val\) => \{/);
});
