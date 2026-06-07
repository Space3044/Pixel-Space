import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('shared progress components exist with accessible determinate and indeterminate states', () => {
  assert.equal(existsSync('src/shared/ui/TaskProgress.vue'), true);
  assert.equal(existsSync('src/shared/ui/LoadingState.vue'), true);

  const progress = read('src/shared/ui/TaskProgress.vue');
  assert.match(progress, /value\?: number \| null/);
  assert.match(progress, /max\?: number/);
  assert.match(progress, /status\?: 'idle' \| 'loading' \| 'success' \| 'error'/);
  assert.match(progress, /const normalizedProgress = computed/);
  assert.match(progress, /const isIndeterminate = computed/);
  assert.match(progress, /role="progressbar"/);
  assert.match(progress, /:aria-valuenow="ariaValueNow"/);
  assert.match(progress, /:class="\{ 'is-indeterminate': isIndeterminate \}"/);
  assert.match(progress, /transform:\s*scaleX/);
  assert.match(progress, /prefers-reduced-motion:\s*reduce/);

  const loadingState = read('src/shared/ui/LoadingState.vue');
  assert.match(loadingState, /import TaskProgress from '\.\/TaskProgress\.vue'/);
  assert.match(loadingState, /role="\w+"/);
  assert.match(loadingState, /<TaskProgress/);
  assert.match(loadingState, /error \|\| message/);
});

test('upload page uses the shared progress component for queue and upload status', () => {
  const view = read('src/features/upload/UploadView.vue');
  const uploadQueue = read('src/features/upload/useUploadQueue.ts');
  assert.match(view, /import TaskProgress from '@\/shared\/ui\/TaskProgress\.vue'/);
  assert.match(view, /taskProgressValue,/);
  assert.match(view, /taskProgressMax,/);
  assert.match(view, /taskProgressStatus,/);
  assert.match(uploadQueue, /const taskProgressValue = computed/);
  assert.match(uploadQueue, /const taskProgressMax = computed/);
  assert.match(uploadQueue, /const taskProgressStatus = computed/);
  assert.match(view, /<TaskProgress\s+class="action-progress"/);
  assert.match(view, /:label="statusLabel"/);
  assert.match(view, /:value="taskProgressValue"/);
  assert.match(view, /:max="taskProgressMax"/);
  assert.match(view, /:status="taskProgressStatus"/);
  assert.doesNotMatch(view, /class="state-dot"/);
});

test('page loading and error states share the same LoadingState component', () => {
  const gallery = read('src/features/images/GalleryView.vue');
  const library = read('src/features/library/LibraryView.vue');
  const footprints = read('src/features/footprints/FootprintsView.vue');

  for (const view of [gallery, library, footprints]) {
    assert.match(view, /import LoadingState from '@\/shared\/ui\/LoadingState\.vue'/);
    assert.match(view, /<LoadingState/);
  }

  assert.match(gallery, /title="正在加载图库"/);
  assert.match(gallery, /:error="loadError"/);
  assert.match(library, /title="正在加载控制台"/);
  assert.match(library, /:error="loadError"/);
  assert.match(footprints, /title="正在加载旅行足迹"/);
  assert.match(footprints, /:error="loadError"/);
});
