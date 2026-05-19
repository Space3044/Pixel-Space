import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const sql = readFileSync(join(process.cwd(), 'db/migrations/0001_init.sql'), 'utf8');
const migration2Path = join(process.cwd(), 'db/migrations/0002_add_exif_focal_length.sql');
const migration2Sql = existsSync(migration2Path) ? readFileSync(migration2Path, 'utf8') : '';

const stripComments = (s) =>
  s
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join('\n');

const sqlBody = stripComments(sql).toLowerCase();
const allSqlBody = stripComments(`${sql}\n${migration2Sql}`).toLowerCase();

test('migration creates the images table', () => {
  assert.match(sqlBody, /create\s+table\s+images/);
});

test('migration declares every MVP column', () => {
  for (const col of [
    'key',
    'title',
    'caption',
    'r2_key',
    'width',
    'height',
    'format',
    'bytes_compressed',
    'bytes_original',
    'hash',
    'location_name',
    'location_lat',
    'location_lng',
    'exif_taken_at',
    'exif_camera',
    'exif_iso',
    'exif_aperture',
    'exif_shutter',
    'created_at',
    'updated_at',
  ]) {
    assert.match(sqlBody, new RegExp(`\\b${col}\\b`), `column ${col} missing`);
  }
});

test('migration adds a created_at index for list ordering', () => {
  assert.match(sqlBody, /create\s+index[^;]+images[^;]+created_at/);
});

test('migration excludes EXIF GPS fields (location only accepts manual lat/lng)', () => {
  for (const keyword of ['gps', 'latitude_exif', 'longitude_exif', 'exif_lat', 'exif_lng', 'exif_gps']) {
    assert.doesNotMatch(sqlBody, new RegExp(`\\b${keyword}\\b`), `forbidden keyword ${keyword} found`);
  }
});

test('migration defers AI and Telegram columns to later stages', () => {
  for (const keyword of [
    'ai_status',
    'ai_caption',
    'tags_json',
    'search_content',
    'ocr_text',
    'tg_file_id',
    'tg_message_id',
    'tg_chat_id',
  ]) {
    assert.doesNotMatch(sqlBody, new RegExp(`\\b${keyword}\\b`), `${keyword} should not be in init migration`);
  }
});

test('migration stores parsed EXIF focal length for upload metadata', () => {
  assert.match(allSqlBody, /\bexif_focal_length\b/);
});
