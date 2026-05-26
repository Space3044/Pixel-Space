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
const migration3Path = join(process.cwd(), 'db/migrations/0003_add_tg_columns.sql');
const migration3Sql = existsSync(migration3Path) ? readFileSync(migration3Path, 'utf8') : '';
const migration4Path = join(process.cwd(), 'db/migrations/0004_add_ai_columns.sql');
const migration4Sql = existsSync(migration4Path) ? readFileSync(migration4Path, 'utf8') : '';
const migration5Path = join(process.cwd(), 'db/migrations/0005_add_original_filename.sql');
const migration5Sql = existsSync(migration5Path) ? readFileSync(migration5Path, 'utf8') : '';
const migration6Path = join(process.cwd(), 'db/migrations/0006_add_ai_visual_fields.sql');
const migration6Sql = existsSync(migration6Path) ? readFileSync(migration6Path, 'utf8') : '';
const migration7Path = join(process.cwd(), 'db/migrations/0007_add_hash_index.sql');
const migration7Sql = existsSync(migration7Path) ? readFileSync(migration7Path, 'utf8') : '';
const migration8Path = join(process.cwd(), 'db/migrations/0008_add_visibility_columns.sql');
const migration8Sql = existsSync(migration8Path) ? readFileSync(migration8Path, 'utf8') : '';
const migration9Path = join(process.cwd(), 'db/migrations/0009_add_folders.sql');
const migration9Sql = existsSync(migration9Path) ? readFileSync(migration9Path, 'utf8') : '';
const migration10Path = join(process.cwd(), 'db/migrations/0010_prune_image_columns.sql');
const migration10Sql = existsSync(migration10Path) ? readFileSync(migration10Path, 'utf8') : '';
const migration11Path = join(process.cwd(), 'db/migrations/0011_add_ai_prompt.sql');
const migration11Sql = existsSync(migration11Path) ? readFileSync(migration11Path, 'utf8') : '';

const stripComments = (s) =>
  s
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join('\n');

const sqlBody = stripComments(sql).toLowerCase();
const allSqlBody = stripComments(
  `${sql}\n${migration2Sql}\n${migration3Sql}\n${migration4Sql}\n${migration5Sql}\n${migration6Sql}\n${migration7Sql}\n${migration8Sql}\n${migration9Sql}\n${migration10Sql}\n${migration11Sql}`,
).toLowerCase();

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

test('migration adds Telegram archive fields after the init migration', () => {
  const migration3Body = stripComments(migration3Sql).toLowerCase();

  for (const col of ['tg_file_id', 'tg_message_id', 'tg_chat_id', 'tg_status', 'tg_error']) {
    assert.match(migration3Body, new RegExp(`\\b${col}\\b`), `column ${col} missing`);
  }
  assert.match(migration3Body, /alter\s+table\s+images\s+add\s+column\s+tg_status/);
  assert.match(migration3Body, /default\s+'pending'/);
});

test('migration adds AI result fields after the init migration', () => {
  const migration4Body = stripComments(migration4Sql).toLowerCase();

  for (const col of [
    'tags_json',
    'search_content',
    'ai_status',
    'ai_error',
    'ai_attempts',
    'ai_finished_at',
  ]) {
    assert.match(migration4Body, new RegExp(`\\b${col}\\b`), `column ${col} missing`);
  }
  assert.match(migration4Body, /alter\s+table\s+images\s+add\s+column\s+ai_status/);
  assert.match(migration4Body, /default\s+'pending'/);
  assert.match(migration4Body, /create\s+table\s+ai_settings/);
  assert.match(migration4Body, /\bproxy_url\b/);
  assert.match(migration4Body, /\bmodel\b/);
  assert.match(migration4Body, /insert\s+into\s+ai_settings/i);
  assert.doesNotMatch(migration4Body, /\bocr_text\b/);
  assert.doesNotMatch(migration4Body, /\bproxy_key\b/);
});

test('migration preserves the original uploaded filename after the init migration', () => {
  assert.match(allSqlBody, /\boriginal_filename\b/);
  assert.doesNotMatch(sqlBody, /\boriginal_filename\b/);
});

test('migration adds AI visual analysis fields after the init migration', () => {
  const migration6Body = stripComments(migration6Sql).toLowerCase();

  for (const col of ['dominant_color', 'color_palette_json', 'composition']) {
    assert.match(migration6Body, new RegExp(`\\b${col}\\b`), `column ${col} missing`);
    assert.doesNotMatch(sqlBody, new RegExp(`\\b${col}\\b`), `${col} should not be in init migration`);
  }
});

test('migration adds editable AI prompt to global settings', () => {
  assert.ok(migration11Sql, 'AI prompt migration missing');
  const migration11Body = stripComments(migration11Sql).toLowerCase();
  assert.match(migration11Body, /alter\s+table\s+ai_settings\s+add\s+column\s+prompt\s+text/);
  assert.doesNotMatch(migration11Body, /\bproxy_key\b/);
});

test('cleanup migration rebuilds images without redundant storage and AI tracking columns', () => {
  assert.ok(migration10Sql, 'cleanup migration missing');
  const migration10Body = stripComments(migration10Sql).toLowerCase();
  const createTableMatch = migration10Body.match(/create\s+table\s+images_next\s*\(([\s\S]*?)\);\s*insert\s+into\s+images_next/i);
  assert.ok(createTableMatch, 'images_next table definition missing');
  const finalSchema = createTableMatch[1];

  for (const col of [
    'r2_key',
    'bytes_original',
    'ocr_text',
    'ai_error',
    'ai_attempts',
    'ai_finished_at',
  ]) {
    assert.doesNotMatch(finalSchema, new RegExp(`\\b${col}\\b`), `${col} should not survive final schema`);
  }

  for (const col of [
    'key',
    'title',
    'caption',
    'original_filename',
    'width',
    'height',
    'format',
    'bytes_compressed',
    'hash',
    'location_name',
    'location_lat',
    'location_lng',
    'exif_taken_at',
    'exif_camera',
    'exif_iso',
    'exif_aperture',
    'exif_shutter',
    'exif_focal_length',
    'tg_file_id',
    'tg_message_id',
    'tg_chat_id',
    'tg_status',
    'tg_error',
    'tags_json',
    'search_content',
    'ai_status',
    'created_at',
    'updated_at',
    'dominant_color',
    'color_palette_json',
    'composition',
    'is_public',
    'location_public',
    'folder_id',
  ]) {
    assert.match(finalSchema, new RegExp(`\\b${col}\\b`), `${col} missing from final schema`);
  }

  assert.match(migration10Body, /create\s+index\s+idx_images_created_at/);
  assert.match(migration10Body, /create\s+index\s+idx_images_hash/);
  assert.match(migration10Body, /create\s+index\s+idx_images_is_public_created_at/);
  assert.match(migration10Body, /create\s+index\s+idx_images_folder_id/);
});
