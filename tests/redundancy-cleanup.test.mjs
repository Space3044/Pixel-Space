import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const legacyName = ['h', 'ive'].join('');
const legacyTitle = '\u8702\u5de2';
const legacyPatterns = [
  new RegExp(`\\b${legacyName}\\b`, 'i'),
  new RegExp(`[\\\\/]${legacyName}\\b`, 'i'),
  new RegExp(`${legacyName}-view`, 'i'),
  new RegExp(legacyTitle),
];
const scanRoots = ['README.md', 'docs', 'src', 'functions', 'tests'];
const scanExtensions = new Set(['.md', '.mjs', '.ts', '.vue']);
const skipFiles = new Set(['tests/redundancy-cleanup.test.mjs']);

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const extensionOf = (path) => path.slice(path.lastIndexOf('.'));

const collectFiles = (path) => {
  const absolute = join(root, path);
  if (!existsSync(absolute)) return [];
  const stats = statSync(absolute);
  if (stats.isFile()) return [path];

  const files = [];
  for (const entry of readdirSync(absolute)) {
    const child = join(path, entry).replace(/\\/g, '/');
    files.push(...collectFiles(child));
  }
  return files;
};

test('source docs and tests no longer keep legacy footprint naming', () => {
  const offenders = scanRoots
    .flatMap(collectFiles)
    .filter((path) => scanExtensions.has(extensionOf(path)))
    .filter((path) => !skipFiles.has(path))
    .flatMap((path) => {
      const text = readFileSync(join(root, path), 'utf8');
      return legacyPatterns.some((pattern) => pattern.test(text)) ? [relative(root, join(root, path))] : [];
    });

  assert.deepEqual(offenders, []);
});

test('redundant unused helpers and legacy fallbacks are not kept', () => {
  const auth = readFileSync(join(root, 'functions/_shared/auth.ts'), 'utf8');
  const libraryApi = readFileSync(join(root, 'src/features/library/library.api.ts'), 'utf8');
  const adminGrants = readFileSync(join(root, 'functions/api/admin/download-grants.ts'), 'utf8');

  assert.doesNotMatch(auth, /requireAdmin|unauthorized/);
  assert.doesNotMatch(libraryApi, /LibraryImage/);
  assert.doesNotMatch(adminGrants, /isMissingCodeColumnError|NULL AS code|no column named code/i);
});
