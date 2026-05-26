import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shell = readFileSync('src/shared/ui/AppShell.vue', 'utf8');
const router = readFileSync('src/app/router.ts', 'utf8');

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('AppShell renames the hive nav entry to footprints', () => {
  assert.match(shell, /\{\s*to:\s*'\/hive',\s*label:\s*'足迹'/);
  assert.doesNotMatch(shell, /\{\s*to:\s*'\/hive',\s*label:\s*'蜂巢'/);
});

test('router title matches the footprints page', () => {
  assert.match(router, /path:\s*'\/hive'[\s\S]*title:\s*'足迹'/);
  assert.doesNotMatch(router, /path:\s*'\/hive'[\s\S]*title:\s*'蜂巢'/);
});

test('AppShell exposes the library route as the admin console', () => {
  assert.match(shell, /\{\s*to:\s*'\/library',\s*label:\s*'控制台',\s*icon:\s*'sliders'\s*\}/);
  assert.match(shell, /sliders:\s*\{\s*vb:\s*'0 0 512 512'/);
  assert.doesNotMatch(shell, /\{\s*to:\s*'\/library',\s*label:\s*'文件库'/);
});

test('router keeps /library but titles it as console', () => {
  assert.match(router, /path:\s*'\/library'[\s\S]*title:\s*'控制台'[\s\S]*requiresAdmin:\s*true/);
  assert.doesNotMatch(router, /path:\s*'\/library'[\s\S]*title:\s*'文件库'/);
});
