for (const path of [
  './file-structure.test.mjs',
  './image-links.test.mjs',
  './migration.test.mjs',
  './access-ui.test.mjs',
  './exif.test.mjs',
  './upload-form.test.mjs',
  './map-style.test.mjs',
  './upload-view.test.mjs',
  './api-shape.test.mjs',
  './telegram.test.mjs',
  './upload-api.test.mjs',
  './original-api.test.mjs',
  './admin-image-api.test.mjs',
  './image-management-ui.test.mjs',
  './public-image-view.test.mjs',
  './image-object.test.mjs',
]) {
  await import(path);
}
