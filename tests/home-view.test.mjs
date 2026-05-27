import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const view = readFileSync('src/features/home/HomeView.vue', 'utf8');

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('HomeView reuses shared helpers and surfaces stats errors', () => {
  assert.match(view, /import \{ formatBytes \} from '@\/features\/images\/image-meta'/);
  assert.match(view, /import \{ fetchJson \} from '@\/shared\/api\/http'/);
  assert.match(view, /stats\.value = await fetchJson<StatsResponse>\('\/api\/stats'\)/);
  assert.match(view, /const loadError = ref<string \| null>\(null\)/);
  assert.match(view, /统计加载失败：\{\{ loadError \}\}/);
  assert.doesNotMatch(view, /fetch\('\/api\/stats'\)|降级显示|const loading = ref/);
});
