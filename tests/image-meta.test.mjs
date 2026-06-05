import assert from 'node:assert/strict';
import {
  formatDateTime,
  formatBytes,
  paletteFromImage,
  parseDominantColor,
  tagsFromImage,
} from '../src/features/images/image-meta.ts';

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('image-meta parses JSON tags and palettes defensively at the UI boundary', () => {
  assert.deepEqual(tagsFromImage({ tags_json: '["猫"," 夜景 ",""]' }), ['猫', '夜景']);
  assert.deepEqual(tagsFromImage({ tags_json: 'not-json' }), []);
  assert.deepEqual(paletteFromImage({ color_palette_json: '["#0F172A"," #F59E0B "]' }), ['#0F172A', '#F59E0B']);
  assert.deepEqual(paletteFromImage({ color_palette_json: '{"bad":true}' }), []);
});

test('image-meta parses dominant color labels and formats bytes with caller-provided empty text', () => {
  assert.deepEqual(parseDominantColor('暮光橙 #F59E0B'), { name: '暮光橙', hex: '#F59E0B' });
  assert.deepEqual(parseDominantColor(null), { name: '未记录', hex: '' });
  assert.equal(formatBytes(0, '未记录'), '未记录');
  assert.equal(formatBytes(1536, '--'), '1.50 KB');
});

test('formatDateTime formats image timestamps with caller-provided empty text', () => {
  assert.equal(formatDateTime(null), '未记录');
  assert.equal(formatDateTime('', '--'), '--');
  assert.equal(formatDateTime('not-a-date'), 'not-a-date');
  assert.equal(formatDateTime('2026-05-20T10:11:12.000Z'), '2026/05/20 18:11:12');
});
