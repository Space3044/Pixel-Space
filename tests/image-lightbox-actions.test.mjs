import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const lightbox = readFileSync('src/features/images/ImageLightbox.vue', 'utf8').replace(/\r\n/g, '\n');
const actionsPath = 'src/features/images/useImageLightboxActions.ts';
const actions = existsSync(actionsPath) ? readFileSync(actionsPath, 'utf8').replace(/\r\n/g, '\n') : '';

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('image lightbox mutations live outside the viewer component', () => {
  assert.equal(existsSync(actionsPath), true, `${actionsPath} should exist`);
  assert.match(lightbox, /import \{ useImageLightboxActions \} from '\.\/useImageLightboxActions'/);
  assert.match(lightbox, /useImageLightboxActions\(\{/);

  for (const localSymbol of [
    'sharePage',
    'resetForm',
    'openAiEditor',
    'cancelAiEditor',
    'saveAiMetadata',
    'rerunAiAnalysis',
    'openLocationEditor',
    'cancelLocationEditor',
    'saveLocation',
    'deleteCurrentImage',
    'saveVisibilityFlag',
  ]) {
    assert.doesNotMatch(lightbox, new RegExp(`const\\s+${localSymbol}\\s*=`), `${localSymbol} should not be local to ImageLightbox`);
    assert.match(actions, new RegExp(`const\\s+${localSymbol}\\s*=`), `${localSymbol} should move into useImageLightboxActions`);
  }
});

test('image lightbox actions own admin image mutations and AI preview refresh', () => {
  assert.match(actions, /import \{ deleteImage, updateImage \} from '\.\/images\.api'/);
  assert.match(actions, /import \{ previewAiAnnotation \} from '\.\/ai-preview\.api'/);
  assert.match(actions, /await updateImage\(image\.value\.key/);
  assert.match(actions, /await deleteImage\(key\)/);
  assert.match(actions, /tagsTextFromImage\(image\.value\)/);
  assert.match(actions, /paletteTextFromImage\(image\.value\)/);
  assert.match(actions, /const aiPreviewing = ref\(false\)/);
  assert.match(actions, /adminPublicImageUrl\(image\.value\.key\)/);
  assert.match(actions, /previewAiAnnotation\(aiImage\)/);
  assert.match(actions, /await copyValue\(buildPublicPageUrl\(image\.value,\s*origin\),\s*'分享链接'\)/);

  assert.doesNotMatch(lightbox, /from '\.\/images\.api'/);
  assert.doesNotMatch(lightbox, /updateImage\(|deleteImage\(/);
});
