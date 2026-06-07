import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const exists = (path) => existsSync(join(root, path));
const read = (path) => readFileSync(join(root, path), 'utf8');
const legacyFeatureName = ['h', 'ive'].join('');
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
    'src/features/upload/UploadActionRow.vue',
    'src/features/upload/UploadFileExifSection.vue',
    'src/features/upload/UploadMetaSidebar.vue',
    'src/features/upload/UploadMetadataSection.vue',
    'src/features/upload/UploadPreviewStage.vue',
    'src/features/upload/UploadQueueRail.vue',
    'src/features/upload/UploadVisibilitySection.vue',
    'src/features/upload/upload-view.css',
    'src/features/images/GalleryView.vue',
    'src/features/images/ImageLightbox.vue',
    'src/features/images/ImageLightboxAiSection.vue',
    'src/features/images/ImageLightboxBasicSection.vue',
    'src/features/images/ImageLightboxCanvas.vue',
    'src/features/images/ImageLightboxDetailsDrawer.vue',
    'src/features/images/ImageLightboxExifSection.vue',
    'src/features/images/ImageLightboxLinksSection.vue',
    'src/features/images/ImageLightboxLocationSection.vue',
    'src/features/images/ImageLightboxTimeSection.vue',
    'src/features/images/ImageLightboxToolbar.vue',
    'src/features/images/image-lightbox-detail-types.ts',
    'src/features/images/image-lightbox.css',
    'src/features/images/PublicImageView.vue',
    'src/features/images/ReadOnlyMap.vue',
    'src/features/images/image.types.ts',
    'src/features/images/image-links.ts',
    'src/features/images/useImageLightboxActions.ts',
    'src/features/images/useImageLightboxDetails.ts',
    'src/features/images/useImageLightboxEditForm.ts',
    'src/features/images/images.api.ts',
    'src/features/library/DownloadGrantManager.vue',
    'src/features/library/LibraryContent.vue',
    'src/features/library/LibraryHeader.vue',
    'src/features/library/LibraryMoveBar.vue',
    'src/features/library/library-view.css',
    'src/features/library/useLibraryActions.ts',
    'src/features/library/useLibraryDirectory.ts',
    'src/features/access/AccessView.vue',
    'src/features/access/access.api.ts',
    'src/features/random/RandomView.vue',
    'src/features/footprints/FootprintsView.vue',
    'src/features/footprints/FootprintFlatMap.vue',
    'src/features/footprints/footprint.ts',
    'src/features/footprints/footprint-map.ts',
    'src/features/footprints/mapbox.ts',
    'src/features/upload/amap.ts',
    'src/features/upload/exif.ts',
    'src/features/upload/map-coordinate.ts',
    'src/features/upload/upload-archive-status.ts',
    'src/features/upload/useUploadFileSelection.ts',
    'src/features/upload/useUploadLocationSync.ts',
    'src/features/upload/useUploadPickMap.ts',
    'src/features/upload/useUploadProcessing.ts',
    'src/features/upload/useUploadQueue.ts',
    'src/features/upload/upload.api.ts',
    'src/features/upload/upload-form.ts',
    'src/features/upload/upload.types.ts',
    'src/features/library/DownloadGrantDialog.vue',
    'src/features/library/download-grant-expiry.ts',
    'src/shared/ui/AppShell.vue',
    'src/styles/main.css',
    'docs/PLAN.md',
    'db/migrations/0001_init.sql',
    'db/migrations/0003_download_grants.sql',
    'db/migrations/0004_download_grant_codes.sql',
    'README.md',
    'functions/types.ts',
    'functions/_shared/http.ts',
    'functions/_shared/security.ts',
    'functions/_shared/download-grants.ts',
    'functions/_shared/ai-preview.ts',
    'functions/_shared/check-hash.ts',
    'functions/_shared/geocode.ts',
    'functions/_shared/images.ts',
    'functions/_shared/original.ts',
    'functions/_shared/static-map.ts',
    'functions/_shared/telegram.ts',
    'functions/_shared/upload.ts',
    'functions/api/amap-config.ts',
    'functions/api/mapbox-config.ts',
    'functions/api/list.ts',
    'functions/api/image/[key].ts',
    'functions/api/public/[[key]].ts',
    'functions/api/admin/list.ts',
    'functions/api/admin/upload.ts',
    'functions/api/admin/check-hash.ts',
    'functions/api/admin/geocode.ts',
    'functions/api/admin/staticmap.ts',
    'functions/api/admin/public/[[key]].ts',
    'functions/api/admin/original/[key].ts',
    'functions/api/admin/ai/preview.ts',
    'functions/api/admin/image/[key].ts',
    'functions/api/admin/download-grants.ts',
    'functions/api/admin/download-grants/[id].ts',
    'functions/api/download-grants/verify.ts',
    'functions/api/download-grants/original/[key].ts',
    'tsconfig.functions.json',
    'wrangler.toml',
    'tests/image-links.test.mjs',
    'tests/auth-security.test.mjs',
    'tests/migration.test.mjs',
    'tests/download-grants-api.test.mjs',
    'tests/download-grants-helpers.test.mjs',
    'tests/download-grant-expiry.test.mjs',
    'tests/download-grants-ui.test.mjs',
    'tests/telegram.test.mjs',
    'tests/original-api.test.mjs',
    'tests/admin-image-api.test.mjs',
    'tests/image-lightbox-actions.test.mjs',
    'tests/image-lightbox-details.test.mjs',
    'tests/image-lightbox-edit-form.test.mjs',
    'tests/image-management-ui.test.mjs',
    'tests/library-actions.test.mjs',
    'tests/library-directory.test.mjs',
    'tests/public-image-view.test.mjs',
    'tests/api-shape.test.mjs',
    'tests/access-ui.test.mjs',
    'tests/exif.test.mjs',
    'tests/map-style.test.mjs',
    'tests/upload-archive-status.test.mjs',
    'tests/upload-api.test.mjs',
    'tests/upload-file-selection.test.mjs',
    'tests/upload-location-sync.test.mjs',
    'tests/upload-pick-map.test.mjs',
    'tests/upload-processing.test.mjs',
    'tests/upload-queue.test.mjs',
    'tests/upload-form.test.mjs',
    'tests/image-object.test.mjs',
  ]) {
    assert.equal(exists(path), true, `${path} should exist`);
  }

  for (const path of [
    'docs/DATABASE.md',
    'docs/references',
    'src/features/auth/auth.store.ts',
    'src/features/images/ImageCard.vue',
    'src/features/images/images.store.ts',
    'src/shared/ui/SearchModal.vue',
    'db/migrations/0005_rate_limits.sql',
    'functions/_shared/rate-limit.ts',
    'functions/api/ai/preview.ts',
    'functions/api/check-hash.ts',
    'functions/api/geocode.ts',
    'functions/api/original/[key].ts',
    'functions/api/upload.ts',
    'tests/frontend-skeleton.test.mjs',
    'tests/backend-read.test.mjs',
    'tests/local-dev.test.mjs',
    `tests/${legacyFeatureName}-view.test.mjs`,
    `src/features/${legacyFeatureName}`,
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
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), [
    'browser-image-compression',
    'exifr',
    'justified-layout',
    'maplibre-gl',
    'three',
    'vue',
    'vue-router',
  ]);
  assert.equal(pkg.dependencies.leaflet, undefined, 'Leaflet is not used');
  assert.equal(pkg.devDependencies['@types/leaflet'], undefined, '@types/leaflet is not needed');
  assert.ok(pkg.devDependencies.wrangler, 'wrangler must be installed from stage 4');
  assert.ok(
    pkg.devDependencies['@cloudflare/workers-types'],
    '@cloudflare/workers-types must be installed from stage 4',
  );
  assert.ok(pkg.devDependencies['@types/three'], '@types/three is needed by the Three.js globe');
  assert.equal(pkg.scripts['db:migrate:local'], 'wrangler d1 migrations apply pixel-space --local');
  assert.equal(pkg.scripts['db:migrate:remote'], 'wrangler d1 migrations apply pixel-space --remote');
  assert.match(read('wrangler.toml'), /PUBLIC_BASE_URL\s*=\s*"\/api\/public"/);
  assert.match(read('.gitignore'), /^\.dev\.vars$/m);
  assert.match(read('README.md'), /TG_BOT_TOKEN/);
  assert.match(read('README.md'), /50MB/);
  assert.match(read('README.md'), /单副本/);
  assert.doesNotMatch(tsconfigApp, /ignoreDeprecations/);
  assert.doesNotMatch(tsconfigApp, /"baseUrl"/);
  assert.match(tsconfigApp, /"@\/\*":\s*\["\.\/src\/\*"\]/);
  assert.deepEqual(
    tsconfig.references.map((reference) => reference.path).sort(),
    ['./tsconfig.app.json', './tsconfig.functions.json', './tsconfig.node.json'],
  );
});
