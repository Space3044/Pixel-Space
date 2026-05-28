import assert from 'node:assert/strict';
import { formatLocationName } from '../src/features/images/location-name.ts';

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('formatLocationName uses title region and detail separated by middle dots', () => {
  assert.equal(
    formatLocationName({
      title: '清水宫',
      regionParts: ['福建省', '厦门市', '湖里区'],
      detailParts: ['清水宫路'],
    }),
    '清水宫 · 福建省厦门市湖里区 · 清水宫路',
  );
});

test('formatLocationName removes repeated administrative and detail fragments', () => {
  assert.equal(
    formatLocationName({
      title: '厦门市',
      regionParts: ['福建省', '厦门市', '思明区'],
      detailParts: ['思明区'],
    }),
    '厦门市 · 福建省',
  );
});

test('formatLocationName keeps foreign comma names unchanged after whitespace cleanup', () => {
  assert.equal(formatLocationName({ title: '  Tokyo Tower, Tokyo, Japan  ' }), 'Tokyo Tower, Tokyo, Japan');
});
