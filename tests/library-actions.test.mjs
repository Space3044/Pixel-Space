import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const view = readFileSync('src/features/library/LibraryView.vue', 'utf8');
const actionsPath = 'src/features/library/useLibraryActions.ts';
const actions = existsSync(actionsPath) ? readFileSync(actionsPath, 'utf8') : '';

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('library admin side effects live outside LibraryView', () => {
  assert.equal(existsSync(actionsPath), true, `${actionsPath} should exist`);
  assert.match(view, /import \{ useLibraryActions \} from '\.\/useLibraryActions'/);
  assert.match(view, /useLibraryActions\(\{/);

  for (const localSymbol of [
    'refreshAll',
    'enterFolder',
    'toggleSelection',
    'selectAllCurrent',
    'clearSelection',
    'clearGrantResult',
    'handleCreateDownloadGrant',
    'handleUpdateDownloadGrant',
    'handleDeleteDownloadGrant',
    'handleCreateFolder',
    'handleRenameCurrent',
    'handleDeleteCurrent',
    'handleMove',
    'handleBatchDelete',
    'saveAiSettings',
  ]) {
    assert.doesNotMatch(view, new RegExp(`const\\s+${localSymbol}\\s*=`), `${localSymbol} should not be local to LibraryView`);
    assert.match(actions, new RegExp(`const\\s+${localSymbol}\\s*=`), `${localSymbol} should move into useLibraryActions`);
  }
});

test('library actions own API calls and local folder count updates', () => {
  assert.match(actions, /fetchAdminFolders\(\)/);
  assert.match(actions, /listAdminImages\(\)/);
  assert.match(actions, /fetchAiSettings\(\)/);
  assert.match(actions, /fetchDownloadGrants\(\)/);
  assert.match(actions, /createDownloadGrant\(/);
  assert.match(actions, /updateDownloadGrant\(/);
  assert.match(actions, /deleteDownloadGrant\(/);
  assert.match(actions, /createFolder\(/);
  assert.match(actions, /updateFolder\(/);
  assert.match(actions, /deleteFolder\(/);
  assert.match(actions, /moveImages\(/);
  assert.match(actions, /deleteImages\(/);
  assert.match(actions, /updateAiSettings\(/);
  assert.match(actions, /const updateFolderImageCount = \(folderId: string \| null, delta: number\) =>/);

  assert.doesNotMatch(view, /Promise\.all\(\[\s*fetchAdminFolders\(\),\s*listAdminImages\(\),/);
  assert.doesNotMatch(view, /moveImages\(|deleteImages\(|updateAiSettings\(/);
});
