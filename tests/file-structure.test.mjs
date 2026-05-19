import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const exists = (path) => existsSync(join(root, path));
const read = (path) => readFileSync(join(root, path), 'utf8');
const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('keeps only the starter code the owner will extend by hand', () => {
  for (const path of [
    'src/app/App.vue',
    'src/app/main.ts',
    'src/app/router.ts',
    'src/features/auth/LoginView.vue',
    'src/features/home/HomeView.vue',
    'src/features/upload/UploadView.vue',
    'src/features/images/GalleryView.vue',
    'src/features/images/ImageLightbox.vue',
    'src/features/images/PublicImageView.vue',
    'src/features/images/image.types.ts',
    'src/features/images/image-links.ts',
    'src/features/images/images.api.ts',
    'src/features/random/RandomView.vue',
    'src/features/hive/HiveView.vue',
    'src/shared/ui/AppShell.vue',
    'src/shared/ui/SearchModal.vue',
    'src/styles/main.css',
    'docs/PLAN.md',
    'db/migrations/0001_init.sql',
    'functions/types.ts',
    'functions/_shared/http.ts',
    'functions/_shared/images.ts',
    'functions/api/list.ts',
    'functions/api/image/[key].ts',
    'tsconfig.functions.json',
    'wrangler.toml',
    'tests/image-links.test.mjs',
    'tests/migration.test.mjs',
    'tests/api-shape.test.mjs',
    'tests/access-ui.test.mjs',
  ]) {
    assert.equal(exists(path), true, `${path} should exist`);
  }

  for (const path of [
    'docs/DATABASE.md',
    'docs/references',
    'src/features/auth/auth.store.ts',
    'src/features/images/ImageCard.vue',
    'src/features/images/images.store.ts',
    'tests/frontend-skeleton.test.mjs',
    'tests/backend-read.test.mjs',
    'tests/local-dev.test.mjs',
  ]) {
    assert.equal(exists(path), false, `${path} should not exist`);
  }
});

test('keeps package scripts and dependencies minimal', () => {
  const pkg = JSON.parse(read('package.json'));
  const tsconfigApp = read('tsconfig.app.json');
  const tsconfig = JSON.parse(read('tsconfig.json'));

  assert.deepEqual(Object.keys(pkg.scripts).sort(), [
    'build',
    'db:migrate:local',
    'db:migrate:remote',
    'dev',
    'dev:pages',
    'preview',
    'test',
    'typecheck',
  ]);
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['justified-layout', 'vue', 'vue-router']);
  assert.ok(pkg.devDependencies.wrangler, 'wrangler must be installed from stage 4');
  assert.ok(
    pkg.devDependencies['@cloudflare/workers-types'],
    '@cloudflare/workers-types must be installed from stage 4',
  );
  assert.doesNotMatch(tsconfigApp, /ignoreDeprecations/);
  assert.doesNotMatch(tsconfigApp, /"baseUrl"/);
  assert.match(tsconfigApp, /"@\/\*":\s*\["\.\/src\/\*"\]/);
  assert.deepEqual(
    tsconfig.references.map((reference) => reference.path).sort(),
    ['./tsconfig.app.json', './tsconfig.functions.json', './tsconfig.node.json'],
  );
});
