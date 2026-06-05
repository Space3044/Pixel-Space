import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const helperPath = new URL('../src/features/images/image-sort.ts', import.meta.url);

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const image = (key, createdAt, exifTakenAt) => ({
  key,
  created_at: createdAt,
  exif_taken_at: exifTakenAt,
});

await test('image sort helper exposes the same four explore sort options', async () => {
  assert.equal(existsSync(helperPath), true, 'expected src/features/images/image-sort.ts to exist');

  const { imageSortOptions } = await import('../src/features/images/image-sort.ts');

  assert.deepEqual(imageSortOptions, [
    { value: 'created-desc', label: '最新上传' },
    { value: 'created-asc', label: '最早上传' },
    { value: 'taken-desc', label: '最新拍摄' },
    { value: 'taken-asc', label: '最早拍摄' },
  ]);
});

await test('sortImagesByMode sorts uploads and shooting time without mutating input', async () => {
  assert.equal(existsSync(helperPath), true, 'expected src/features/images/image-sort.ts to exist');

  const { sortImagesByMode } = await import('../src/features/images/image-sort.ts');
  const records = [
    image('old-upload', '2024-01-01T00:00:00Z', '2023-01-01T00:00:00Z'),
    image('new-upload', '2024-03-01T00:00:00Z', null),
    image('middle-upload', '2024-02-01T00:00:00Z', '2024-01-01T00:00:00Z'),
  ];

  assert.deepEqual(sortImagesByMode(records, 'created-desc').map((item) => item.key), [
    'new-upload',
    'middle-upload',
    'old-upload',
  ]);
  assert.deepEqual(sortImagesByMode(records, 'created-asc').map((item) => item.key), [
    'old-upload',
    'middle-upload',
    'new-upload',
  ]);
  assert.deepEqual(sortImagesByMode(records, 'taken-desc').map((item) => item.key), [
    'middle-upload',
    'old-upload',
    'new-upload',
  ]);
  assert.deepEqual(sortImagesByMode(records, 'taken-asc').map((item) => item.key), [
    'old-upload',
    'middle-upload',
    'new-upload',
  ]);
  assert.deepEqual(records.map((item) => item.key), ['old-upload', 'new-upload', 'middle-upload']);
});
