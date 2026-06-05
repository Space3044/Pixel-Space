import assert from 'node:assert/strict';
import {
  DEFAULT_DOWNLOAD_GRANT_PRESET,
  DOWNLOAD_GRANT_EXPIRY_OPTIONS,
  buildDownloadGrantExpiry,
  formatDownloadGrantExpiry,
} from '../src/features/library/download-grant-expiry.ts';

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('download grant expiry presets include one seven thirty days and custom', () => {
  assert.equal(DEFAULT_DOWNLOAD_GRANT_PRESET, '7d');
  assert.deepEqual(
    DOWNLOAD_GRANT_EXPIRY_OPTIONS.map((option) => option.value),
    ['1d', '7d', '30d', 'custom'],
  );
});

test('buildDownloadGrantExpiry returns future ISO strings for presets', () => {
  const now = new Date('2026-06-05T00:00:00.000Z');
  assert.equal(buildDownloadGrantExpiry('1d', '', now), '2026-06-06T00:00:00.000Z');
  assert.equal(buildDownloadGrantExpiry('7d', '', now), '2026-06-12T00:00:00.000Z');
  assert.equal(buildDownloadGrantExpiry('30d', '', now), '2026-07-05T00:00:00.000Z');
});

test('buildDownloadGrantExpiry accepts only future custom datetime values', () => {
  const now = new Date('2026-06-05T00:00:00.000Z');
  assert.equal(buildDownloadGrantExpiry('custom', '2026-06-06T08:30', now), new Date('2026-06-06T08:30').toISOString());
  assert.equal(buildDownloadGrantExpiry('custom', '2026-06-04T08:30', now), null);
  assert.equal(buildDownloadGrantExpiry('custom', '', now), null);
});

test('formatDownloadGrantExpiry renders Beijing time for dialog results', () => {
  assert.equal(formatDownloadGrantExpiry('2026-06-06T11:31:43.109Z'), '北京时间 2026-06-06 19:31');
});
