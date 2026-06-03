import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const view = readFileSync('src/features/images/PublicImageView.vue', 'utf8');

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('PublicImageView updates Open Graph metadata after loading the image', () => {
  assert.match(view, /ensureMeta\('og:image', buildAbsoluteImageUrl\(image\.public_url,\s*origin\)\)/);
  assert.match(view, /ensureMeta\('og:title', image\.title/);
  assert.match(view, /ensureMeta\('og:description', image\.caption/);
});

test('PublicImageView does not render public copy link controls', () => {
  assert.match(view, /import \{\s*buildAbsoluteImageUrl\s*\} from '\.\/image-links'/);
  assert.doesNotMatch(view, /buildMarkdown|buildHtml|buildPublicPageUrl/);
  assert.doesNotMatch(view, /linkRows|copiedLabel|navigator\.clipboard|COPY_ICON|CHECK_ICON/);
  assert.doesNotMatch(view, /Copy Links|复制|Markdown|公开页直链|label:\s*'HTML'|>HTML</);
  assert.doesNotMatch(view, /class="link-row"|class="link-copy"|class="link-value"|class="link-label"/);
});

test('PublicImageView always reserves the location card and falls back to a placeholder when hidden or missing', () => {
  assert.match(view, /import ReadOnlyMap from '\.\/ReadOnlyMap\.vue'/);
  assert.match(view, /:lat="image\.location_public === 0 \? null : image\.location_lat"/);
  assert.match(view, /:lng="image\.location_public === 0 \? null : image\.location_lng"/);
});

test('PublicImageView lays out the image and information side by side on desktop', () => {
  assert.match(view, /class="public-image-layout"/);
  assert.match(view, /class="public-image-preview/);
  assert.match(view, /class="public-image-info/);
  assert.match(view, /\.public-image-layout\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*24rem;/s);
  assert.match(view, /@media \(max-width:\s*900px\)\s*\{[^}]*\.public-image-layout\s*\{[^}]*grid-template-columns:\s*1fr;/s);
});

test('PublicImageView shows exposure metadata in the information column', () => {
  assert.match(view, /const exifRows = computed/);
  assert.match(view, /exif_shutter/);
  assert.match(view, /exif_iso/);
  assert.match(view, /exif_aperture/);
  assert.match(view, /exif_focal_length/);
  assert.match(view, /class="public-exif-grid"/);
  assert.match(view, /快门/);
  assert.match(view, /ISO/);
  assert.match(view, /光圈/);
  assert.match(view, /焦距/);
});

test('PublicImageView stretches the image preview to match the info column height', () => {
  assert.match(view, /\.public-image-layout\s*\{[^}]*align-items:\s*stretch;/s);
  assert.match(view, /\.public-image-preview\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;/s);
  assert.match(view, /\.public-image-img\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*object-fit:\s*contain;/s);
});
