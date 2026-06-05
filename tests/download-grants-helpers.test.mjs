import assert from 'node:assert/strict';
import {
  ACCESS_CODE_ALPHABET,
  codeHash,
  generateAccessCode,
  imageBelongsToGrant,
  loadGrantImages,
  normalizeAccessCode,
  resolveActiveGrant,
} from '../functions/_shared/download-grants.ts';
import { downloadName } from '../functions/_shared/original.ts';

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const sampleRow = {
  key: 'img-key',
  title: '猫猫',
  caption: null,
  original_filename: 'cat.jpg',
  width: 1200,
  height: 800,
  format: 'webp',
  bytes_compressed: 123456,
  location_name: '秘密地点',
  location_lat: 31,
  location_lng: 121,
  location_region: 'china',
  exif_taken_at: null,
  exif_camera: null,
  exif_iso: null,
  exif_aperture: null,
  exif_shutter: null,
  exif_focal_length: null,
  tags_json: null,
  dominant_color: null,
  color_palette_json: null,
  composition: null,
  ai_status: 'done',
  created_at: '2026-05-20 10:11:12',
  updated_at: '2026-05-21 12:13:14',
  is_public: 0,
  location_public: 0,
  folder_id: null,
};

await test('normalizeAccessCode trims uppercases and rejects invalid values', () => {
  assert.equal(normalizeAccessCode(' a7k9p2qx '), 'A7K9P2QX');
  assert.equal(normalizeAccessCode(''), null);
  assert.equal(normalizeAccessCode('abc'), null);
  assert.equal(normalizeAccessCode('ABC-1234'), null);
  assert.equal(normalizeAccessCode('OOOOOOOO'), null);
  assert.equal(normalizeAccessCode(null), null);
});

await test('codeHash hashes normalized code consistently', async () => {
  assert.equal(await codeHash(' a7k9p2qx '), await codeHash('A7K9P2QX'));
  assert.match(await codeHash('A7K9P2QX'), /^[a-f0-9]{64}$/);
});

await test('generateAccessCode uses the configured readable alphabet', () => {
  const code = generateAccessCode();
  assert.equal(code.length, 8);
  for (const char of code) assert.equal(ACCESS_CODE_ALPHABET.includes(char), true);
});

await test('resolveActiveGrant returns only unexpired grants', async () => {
  const calls = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          calls.push({ sql, values });
          return { first: async () => ({ id: 'grant-1', expires_at: '2999-01-01T00:00:00.000Z' }) };
        },
      };
    },
  };

  const grant = await resolveActiveGrant(db, 'A7K9P2QX');
  assert.deepEqual(grant, { id: 'grant-1', expires_at: '2999-01-01T00:00:00.000Z' });
  assert.match(calls[0].sql, /code_hash\s*=\s*\?/i);
  assert.match(calls[0].sql, /expires_at\s*>\s*\?/i);
});

await test('loadGrantImages returns visitor-safe records', async () => {
  const db = {
    prepare(sql) {
      assert.match(sql, /download_grant_images/i);
      return {
        bind(...values) {
          assert.deepEqual(values, ['grant-1']);
          return { all: async () => ({ results: [sampleRow] }) };
        },
      };
    },
  };

  const records = await loadGrantImages(db, 'grant-1', 'https://cdn.test');
  assert.equal(records.length, 1);
  assert.equal(records[0].key, 'img-key');
  assert.equal(records[0].public_url, 'https://cdn.test/img-key');
  assert.equal(records[0].location_name, null);
  assert.equal(records[0].location_lat, null);
  assert.equal(records[0].location_lng, null);
});

await test('imageBelongsToGrant checks grant membership by key', async () => {
  const db = {
    prepare(sql) {
      assert.match(sql, /download_grant_images/i);
      return {
        bind(...values) {
          assert.deepEqual(values, ['grant-1', 'img-key']);
          return { first: async () => ({ image_key: 'img-key' }) };
        },
      };
    },
  };

  assert.equal(await imageBelongsToGrant(db, 'grant-1', 'img-key'), true);
});

await test('downloadName keeps safe filenames and replaces unsafe characters', () => {
  assert.equal(downloadName('cat.jpg'), 'cat.jpg');
  assert.equal(downloadName('猫 猫.jpg'), '___.jpg');
  assert.equal(downloadName(''), 'original');
});
