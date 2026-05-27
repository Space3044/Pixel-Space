import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
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

const migrationDir = join(process.cwd(), 'db/migrations');
const migrationFiles = readdirSync(migrationDir).filter((name) => name.endsWith('.sql')).sort();
const sql = readFileSync(join(migrationDir, '0001_init.sql'), 'utf8');

const stripComments = (s) =>
  s
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join('\n');

const sqlBody = stripComments(sql).toLowerCase();
const tableBody = (tableName) => {
  const match = sqlBody.match(new RegExp(`create\\s+table\\s+${tableName}\\s*\\(([\\s\\S]*?)\\);`));
  assert.ok(match, `${tableName} table definition missing`);
  return match[1];
};

test('migration is consolidated into a single init file', () => {
  assert.deepEqual(migrationFiles, ['0001_init.sql']);
  assert.doesNotMatch(sqlBody, /\balter\s+table\b/);
  assert.doesNotMatch(sqlBody, /\bimages_next\b/);
});

test('migration creates the final images table', () => {
  const images = tableBody('images');

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
    assert.match(images, new RegExp(`\\b${col}\\b`), `${col} missing from images schema`);
  }
});

test('migration excludes removed image columns', () => {
  const images = tableBody('images');

  for (const col of [
    'r2_key',
    'bytes_original',
    'ocr_text',
    'ai_error',
    'ai_attempts',
    'ai_finished_at',
    'proxy_key',
  ]) {
    assert.doesNotMatch(images, new RegExp(`\\b${col}\\b`), `${col} should not exist`);
  }
});

test('migration excludes EXIF-only coordinate columns', () => {
  for (const keyword of ['gps', 'latitude_exif', 'longitude_exif', 'exif_lat', 'exif_lng', 'exif_gps']) {
    assert.doesNotMatch(sqlBody, new RegExp(`\\b${keyword}\\b`), `forbidden keyword ${keyword} found`);
  }
});

test('migration creates folders and AI settings tables', () => {
  const folders = tableBody('folders');
  const aiSettings = tableBody('ai_settings');

  for (const col of ['id', 'parent_id', 'name', 'created_at', 'updated_at']) {
    assert.match(folders, new RegExp(`\\b${col}\\b`), `${col} missing from folders schema`);
  }

  for (const col of ['id', 'proxy_url', 'model', 'prompt', 'updated_at']) {
    assert.match(aiSettings, new RegExp(`\\b${col}\\b`), `${col} missing from ai_settings schema`);
  }

  assert.match(sqlBody, /insert\s+into\s+ai_settings\s*\(\s*id,\s*proxy_url,\s*model,\s*prompt\s*\)/);
  assert.doesNotMatch(aiSettings, /\bproxy_key\b/);
});

test('migration seeds the editable AI prompt in the database', () => {
  assert.match(sql, /INSERT INTO ai_settings \(id, proxy_url, model, prompt\) VALUES \(1, '', '', '# 图片结构化分析专家/);
});

test('migration creates final indexes', () => {
  assert.match(sqlBody, /create\s+unique\s+index\s+idx_folders_parent_name/);
  assert.match(sqlBody, /create\s+index\s+idx_images_created_at/);
  assert.match(sqlBody, /create\s+index\s+idx_images_hash/);
  assert.match(sqlBody, /create\s+index\s+idx_images_is_public_created_at/);
  assert.match(sqlBody, /create\s+index\s+idx_images_folder_id/);
});
