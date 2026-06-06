import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const gallery = readFileSync('src/features/images/GalleryView.vue', 'utf8');
const lightbox = readFileSync('src/features/images/ImageLightbox.vue', 'utf8');
const imageMeta = readFileSync('src/features/images/image-meta.ts', 'utf8');
const readOnlyMap = readFileSync('src/features/images/ReadOnlyMap.vue', 'utf8');
const imagesApi = readFileSync('src/features/images/images.api.ts', 'utf8');

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('GalleryView wires the search box to listImages(query)', () => {
  assert.match(gallery, /const searchQuery = ref/);
  assert.match(gallery, /listImagesPage\(searchQuery\.value,\s*\{ folderId,\s*limit: GALLERY_PAGE_SIZE \}\)/);
  assert.match(gallery, /const GALLERY_PAGE_SIZE = 48/);
  assert.match(gallery, /const nextCursor = ref<string \| null>\(null\)/);
  assert.match(gallery, /const loadMoreImages = async \(\) => \{/);
  assert.match(gallery, /加载更多/);
  assert.match(gallery, /@submit\.prevent="loadImages"/);
  assert.match(gallery, /placeholder="搜索标题、描述、文件名或位置"/);
  assert.match(gallery, /class="explore-header"/);
  assert.match(gallery, />探索</);
  assert.match(gallery, /发现公开图片/);
  assert.match(gallery, /const folderLoadError = ref<string \| null>\(null\)/);
  assert.match(gallery, /文件夹加载失败：\{\{ folderLoadError \}\}/);
  assert.doesNotMatch(gallery, /文件夹列表拿不到不阻塞主页面/);
  assert.doesNotMatch(gallery, /to="\/upload"/);
  assert.doesNotMatch(gallery, /上传图片/);
  assert.match(gallery, /resultLabel/);
  assert.match(gallery, /清空/);
});

test('images.api exposes admin update and delete helpers', () => {
  assert.match(imagesApi, /from '@\/shared\/api\/http'/);
  assert.match(imagesApi, /export function listImages\(query = '', options: ListImagesOptions = \{\}\)/);
  assert.match(imagesApi, /export function listImagesPage\(query = '', options: ListImagesPageOptions\)/);
  assert.match(imagesApi, /params\.set\('limit', String\(options\.limit\)\)/);
  assert.match(imagesApi, /cursor/);
  assert.match(imagesApi, /URLSearchParams/);
  assert.match(imagesApi, /export function updateImage/);
  assert.match(imagesApi, /method: 'PATCH'/);
  assert.match(imagesApi, /export function deleteImage/);
  assert.match(imagesApi, /method: 'DELETE'/);
});

test('ImageLightbox provides edit, delete, original download, copy links and map management UI', () => {
  assert.match(lightbox, /import \{[^}]*buildImageLinkRows[^}]*buildPublicPageUrl[^}]*\} from '\.\/image-links'/s);
  assert.match(lightbox, /import \{ useClipboardFeedback \} from '\.\/useClipboardFeedback'/);
  assert.match(lightbox, /import \{ useImageZoom \} from '\.\/useImageZoom'/);
  assert.match(lightbox, /from '\.\/image-meta'/);
  assert.match(lightbox, /import ReadOnlyMap from '\.\/ReadOnlyMap\.vue'/);
  assert.match(lightbox, /updateImage/);
  assert.match(lightbox, /deleteImage/);
  assert.match(lightbox, /defineEmits<\{ close: \[\]; prev: \[\]; next: \[\]; updated:/);
  assert.match(lightbox, /formatBytes\(image\.bytes_compressed\)/);
  assert.match(lightbox, /formatImageTimestamp\(image\.created_at\)/);
  assert.match(lightbox, /formatImageTimestamp\(image\.updated_at\)/);
  assert.doesNotMatch(lightbox, /后续接入/);
  assert.match(lightbox, /image\.original_filename \|\| image\.key/);
  assert.doesNotMatch(lightbox, /<span class="item-label">文件名<\/span>\s*<span class="item-value text-truncate">\{\{ image\.title/s);
  assert.doesNotMatch(lightbox, /存储时长/);
  assert.match(lightbox, /class="viewer-action-btn danger"/);
  assert.match(lightbox, /ICONS\.trash/);
  assert.match(lightbox, /class="viewer-esc-button"/);
  assert.match(lightbox, />ESC<\/button>/);
  assert.match(lightbox, /\.viewer-esc-button\s*\{[^}]*width:\s*36px;[^}]*height:\s*28px;/s);
  assert.match(lightbox, /\.navigation-bar\s*\{[^}]*padding:\s*12px 16px;/s);
  assert.doesNotMatch(lightbox, /class="nav-title"/);
  assert.doesNotMatch(lightbox, /class="viewer-title"/);
  assert.doesNotMatch(lightbox, /class="viewer-action-btn" title="关闭"/);
  assert.doesNotMatch(lightbox, /panelClose|收起详情面板/);
  assert.match(lightbox, /const handleViewerSurfaceClick = \(\) => \{/);
  assert.match(lightbox, /if \(detailsOpen\.value\) \{\s*detailsOpen\.value = false;\s*return;\s*\}/s);
  assert.match(lightbox, /class="viewer-backdrop" @click="handleViewerSurfaceClick"/);
  assert.match(lightbox, /class="image-canvas"\s+:class="\{ 'has-drawer': detailsOpen \}"\s+@click="handleViewerSurfaceClick"/);
  assert.doesNotMatch(lightbox, /text-danger-button/);
  assert.match(lightbox, /aiEditOpen/);
  assert.match(lightbox, /const aiTags = computed/);
  assert.match(lightbox, /const aiPalette = computed/);
  assert.match(lightbox, /const dominantColor = computed/);
  assert.match(lightbox, /parseDominantColor/);
  assert.doesNotMatch(lightbox, /const tagsFromImage = |const paletteFromImage = |JSON\.parse\(image\.tags_json\)|JSON\.parse\(image\.color_palette_json\)/);
  assert.match(lightbox, /v-for="tag in aiTags"/);
  assert.match(lightbox, /v-for="color in aiPalette"/);
  assert.match(lightbox, /class="dominant-color-value"/);
  assert.match(lightbox, /class="palette-chip dominant-color-chip"/);
  assert.match(lightbox, /:title="dominantColor\.hex \|\| image\.dominant_color"/);
  assert.match(lightbox, /image\.dominant_color/);
  assert.match(lightbox, /image\.composition/);
  assert.doesNotMatch(lightbox, /image\.ocr_text/);
  assert.doesNotMatch(lightbox, />OCR</);
  assert.match(lightbox, /class="ai-edit-button"/);
  assert.match(lightbox, /<form v-if="aiEditOpen" class="ai-edit-form" @submit\.prevent="saveAiMetadata">/);
  assert.match(lightbox, /v-model="editForm\.title"/);
  assert.match(lightbox, /v-model="editForm\.caption"/);
  assert.match(lightbox, /v-model="editForm\.tags"/);
  assert.match(lightbox, /v-model="editForm\.dominant_color"/);
  assert.match(lightbox, /v-model="editForm\.palette"/);
  assert.match(lightbox, /v-model="editForm\.composition"/);
  assert.match(lightbox, /tags:\s*editForm\.tags/);
  assert.match(lightbox, /dominant_color:\s*editForm\.dominant_color/);
  assert.match(lightbox, /palette:\s*editForm\.palette/);
  assert.match(lightbox, /composition:\s*editForm\.composition/);
  assert.match(lightbox, /const tagsTextFromImage/);
  assert.match(lightbox, /\.palette-list\s*\{[^}]*flex-wrap:\s*nowrap;[^}]*overflow-x:\s*auto;/s);
  assert.match(lightbox, /\.palette-chip\s*\{[^}]*width:\s*20px;[^}]*height:\s*20px;/s);
  assert.match(lightbox, /class="location-edit-button"/);
  assert.match(lightbox, /<form v-if="locationEditOpen" class="location-edit-form" @submit\.prevent="saveLocation">/);
  assert.match(lightbox, /v-model="editForm\.location_lat"/);
  assert.match(lightbox, /v-model="editForm\.location_lng"/);
  assert.match(lightbox, /class="detail-items location-display"/);
  assert.match(lightbox, /经纬度/);
  assert.doesNotMatch(lightbox, /location-summary|已标记位置/);
  assert.match(lightbox, /ReadOnlyMap/);
  assert.doesNotMatch(lightbox, /empty-map-note|添加经纬度后会在这里显示地图标记/);
  assert.doesNotMatch(lightbox, /v-if="image\.location_lat !== null && image\.location_lng !== null"/);
  assert.match(lightbox, /:interactive="locationEditOpen"/);
  assert.match(lightbox, /@pick="updateLocationFromMap"/);
  assert.match(lightbox, /const updateLocationFromMap/);
  assert.match(lightbox, /editForm\.location_lat = coords\.lat/);
  assert.match(lightbox, /editForm\.location_lng = coords\.lng/);
  assert.match(lightbox, /class="exif-grid"/);
  assert.match(lightbox, /class="detail-item exif-item"/);
  assert.match(lightbox, /row\.span === 'full'/);
  assert.match(lightbox, /exifRows/);
  assert.match(lightbox, />EXIF</);
  assert.match(lightbox, /拍摄时间/);
  assert.match(lightbox, /相机/);
  assert.match(lightbox, /焦距/);
  assert.match(lightbox, /\/api\/original\/\$\{encodeURIComponent\(image\.key\)\}/);
  assert.match(lightbox, /buildImageLinkRows\(props\.image,\s*origin\)/);
  assert.doesNotMatch(lightbox, /const imageUrl = buildAbsoluteImageUrl\(props\.image\.public_url,\s*origin\)/);
  assert.doesNotMatch(lightbox, /const imageForCopy = \{ \.\.\.props\.image, public_url: imageUrl \}/);
  assert.match(lightbox, /confirm\('确认删除这张图片？'\)/);
  assert.doesNotMatch(lightbox, /内容安全/);
  assert.doesNotMatch(lightbox, /阶段 11 接入 AI 描述|全屏（阶段|ICONS\.expand/);
  assert.match(lightbox, /class="image-canvas"\s+:class="\{ 'has-drawer': detailsOpen \}"/);
  assert.match(lightbox, /\.image-canvas\.has-drawer\s*\{[^}]*right:\s*420px;/s);
});

test('ImageLightbox formats detail timestamps in Beijing time', () => {
  assert.match(lightbox, /formatDateTime/);
  assert.match(imageMeta, /new Intl\.DateTimeFormat\('zh-CN',\s*\{[\s\S]*timeZone,/);
  assert.match(imageMeta, /timeZone = 'Asia\/Shanghai'/);
  assert.doesNotMatch(lightbox, /D1_UTC_DATE_TIME_PATTERN|assumeUtc/);
  assert.match(lightbox, /const formatExifTakenAt = \(value: string \| null \| undefined\): string =>\s*formatDateTime\(value\)/);
  assert.match(lightbox, /const formatImageTimestamp = \(value: string \| null \| undefined\): string =>\s*formatDateTime\(value\)/);
  assert.match(lightbox, /formatImageTimestamp\(image\.created_at\)/);
  assert.match(lightbox, /formatImageTimestamp\(image\.updated_at\)/);
});

test('ImageLightbox uses the PixelPunk-style viewer scale and icon controls', () => {
  assert.match(lightbox, /useImageZoom\(\)/);
  assert.match(lightbox, /class="cyber-image-viewer"/);
  assert.match(lightbox, /class="navigation-bar"/);
  assert.match(lightbox, /class="image-canvas"/);
  assert.match(lightbox, /class="main-image"/);
  assert.match(lightbox, /\.main-image\s*\{[^}]*max-width:\s*100%;[^}]*max-height:\s*100%;[^}]*object-fit:\s*contain;/s);
  assert.match(lightbox, /class="viewer-action-btn"/);
  assert.match(lightbox, /class="nav-arrow nav-arrow-left"/);
  assert.match(lightbox, /class="nav-arrow nav-arrow-right"/);
  assert.doesNotMatch(lightbox, /class="control-bar"/);
  assert.doesNotMatch(lightbox, /class="control-btn"/);
  assert.doesNotMatch(lightbox, /I 详情|e\.key === 'i'|e\.key === 'I'/);
  assert.doesNotMatch(lightbox, /bg-grid/);
});

test('ImageLightbox toggles the bottom zoom controls from image clicks', () => {
  assert.match(lightbox, /const imageControlsHidden = ref\(false\)/);
  assert.match(lightbox, /const toggleImageControls = \(\) => \{/);
  assert.match(lightbox, /imageControlsHidden\.value = !imageControlsHidden\.value/);
  assert.match(lightbox, /@click\.stop="toggleImageControls"/);
  assert.match(lightbox, /v-if="image && !imageControlsHidden" class="image-controls"/);
  assert.match(lightbox, /imageControlsHidden\.value = false/);
  assert.doesNotMatch(lightbox, /previewHidden|togglePreview|preview-hidden-state|隐藏图片预览|预览已隐藏/);
});

test('ReadOnlyMap supports empty coordinates and interactive coordinate picking', () => {
  assert.match(readOnlyMap, /const DEFAULT_CENTER/);
  assert.match(readOnlyMap, /lat\?: number \| null/);
  assert.match(readOnlyMap, /lng\?: number \| null/);
  assert.match(readOnlyMap, /region\?: string \| null/);
  assert.match(readOnlyMap, /const region = getRegion\(\)/);
  assert.match(readOnlyMap, /\/api\/staticmap\?lat=\$\{coordinates\.lat\}&lng=\$\{coordinates\.lng\}&region=\$\{region\}/);
  assert.match(readOnlyMap, /interactive\?: boolean/);
  assert.match(readOnlyMap, /defineEmits<\{ pick:/);
  assert.match(readOnlyMap, /emit\('pick'/);
  assert.match(readOnlyMap, /map\.on\('click'/);
  assert.match(readOnlyMap, /marker\?\.setMap\(null\);\s*marker = null;/s);
  assert.match(readOnlyMap, /center: mapCenter\(\)/);
  assert.match(readOnlyMap, /dragEnable: props\.interactive/);
  assert.match(readOnlyMap, /storedLngLatFromMap/);
  assert.match(readOnlyMap, /readonly-map-placeholder/);
  assert.match(lightbox, /const mapRegion = computed/);
  assert.match(lightbox, /:region="mapRegion"/);
});
