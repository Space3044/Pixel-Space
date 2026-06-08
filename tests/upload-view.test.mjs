import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const uploadSurfaceFiles = [
  'src/features/upload/UploadView.vue',
  'src/features/upload/UploadActionRow.vue',
  'src/features/upload/UploadFileExifSection.vue',
  'src/features/upload/UploadMetaSidebar.vue',
  'src/features/upload/UploadMetadataSection.vue',
  'src/features/upload/UploadPreviewStage.vue',
  'src/features/upload/UploadQueueRail.vue',
  'src/features/upload/UploadVisibilitySection.vue',
  'src/features/upload/upload-view.css',
];
const view = uploadSurfaceFiles.map((path) => readFileSync(path, 'utf8')).join('\n').replace(/\r\n/g, '\n');
const uploadQueue = readFileSync('src/features/upload/useUploadQueue.ts', 'utf8');
const uploadFileSelection = readFileSync('src/features/upload/useUploadFileSelection.ts', 'utf8');
const uploadPickMap = readFileSync('src/features/upload/useUploadPickMap.ts', 'utf8');
const uploadProcessing = readFileSync('src/features/upload/useUploadProcessing.ts', 'utf8');
const uploadArchiveStatus = readFileSync('src/features/upload/upload-archive-status.ts', 'utf8');
const uploadApi = readFileSync('src/features/upload/upload.api.ts', 'utf8');
const aiPreviewApi = readFileSync('src/features/upload/ai-preview.api.ts', 'utf8');
const imagesAiPreviewApi = readFileSync('src/features/images/ai-preview.api.ts', 'utf8');
const geocodeApi = readFileSync('src/features/images/geocode.api.ts', 'utf8');
const plan = readFileSync('docs/PLAN.md', 'utf8');

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const extract = (start, end) => {
  const startIndex = view.indexOf(start);
  assert.notEqual(startIndex, -1, `missing start marker: ${start}`);
  const endIndex = view.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `missing end marker: ${end}`);
  return view.slice(startIndex, endIndex);
};

test('upload page removes the redundant hero copy block', () => {
  assert.doesNotMatch(view, /class="hero-left"/);
  assert.doesNotMatch(view, /\.hero-(eyebrow|title|sub)\b/);
});

test('upload queue count uses a compact status label instead of raw zero count', () => {
  assert.match(view, /queueCountLabel/);
  assert.doesNotMatch(view, /\{\{\s*hasFile\s*\?\s*'1'\s*:\s*'0'\s*\}\}\s*张/);
});

test('upload queue rail is wide enough and scrolls inside the fixed workbench on desktop', () => {
  assert.match(view, /grid-template-columns:\s*8\.5rem minmax\(0,\s*1fr\) 24rem/);
  assert.match(view, /height:\s*clamp\(32rem,\s*calc\(100svh - 13rem\),\s*46rem\)/);

  const desktopQueueList = extract('@media (min-width: 1024px) {\n  .queue-list', '\n  }\n}\n\n.thumb-cell');
  assert.match(desktopQueueList, /overflow-y:\s*auto/);
  assert.match(desktopQueueList, /min-height:\s*0/);
  assert.doesNotMatch(desktopQueueList, /max-height:/);
});

test('upload workbench keeps the preview fixed while side panels scroll with styled scrollbars', () => {
  const desktopWorkbench = extract('@media (min-width: 1024px) {\n  .workbench', '\n  }\n}\n\n.queue-rail');
  assert.match(desktopWorkbench, /height:\s*clamp\(32rem,\s*calc\(100svh - 13rem\),\s*46rem\)/);

  const desktopPreview = extract('@media (min-width: 1024px) {\n  .preview-stage', '\n  }\n}\n\n.meta-sidebar');
  assert.match(desktopPreview, /height:\s*100%/);
  assert.match(desktopPreview, /min-height:\s*0/);

  const metaSidebar = extract('.meta-sidebar {', '\n}\n\n.meta-section');
  assert.match(metaSidebar, /overflow-y:\s*auto/);
  assert.match(metaSidebar, /min-height:\s*0/);

  assert.match(view, /\.queue-list,\n\.meta-sidebar\s*\{\n[\s\S]*scrollbar-width:\s*thin/);
  assert.match(view, /\.queue-list::-webkit-scrollbar-thumb,\n\.meta-sidebar::-webkit-scrollbar-thumb/);
});

test('upload map can place a marker before a file is selected', () => {
  // 点选回调在 pick-map adapter 里触发，UploadView 不再用被移除的 selectedFile 把关
  assert.doesNotMatch(view, /selectedFile\.value/);

  const mapBlock = extract('<div class="map-block">', '  </section>\n</template>');
  assert.doesNotMatch(mapBlock, /:disabled="!hasFile"/);
});

test('upload page avoids oversized rounded corners', () => {
  const oversizedRadius = /border-radius:\s*(?:0\.8[0-9]*rem|[1-9]\d*(?:\.\d+)?rem|9999px|999px)/;
  assert.doesNotMatch(view, oversizedRadius);
  assert.match(view, /\.upload-page\s+\.cyber-input/);
  assert.match(view, /\.upload-page\s+\.cyber-button/);
});

test('upload page removes the floating hero status block', () => {
  assert.doesNotMatch(view, /class="page-hero"/);
  assert.doesNotMatch(view, /class="hero-status"/);
  assert.doesNotMatch(view, /\.page-hero|\.hero-status|\.status-dot/);
});

test('upload drop zone centers its content', () => {
  const dropZoneBlock = extract('.drop-zone {', '\n}\n.drop-zone:hover');
  assert.match(dropZoneBlock, /justify-content:\s*center/);
  assert.match(dropZoneBlock, /text-align:\s*center/);
});

test('upload page defers progress UI to a later shared component', () => {
  assert.doesNotMatch(view, /compressionProgress|onProgress|压缩进度|压缩中\s*\{\{/);
  assert.match(plan, /统一进度条组件/);
});

test('upload action area stacks controls into full-width touch rows on mobile', () => {
  assert.match(view, /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.drop-zone\s*\{[\s\S]*?flex-direction:\s*column;[\s\S]*?padding:\s*1rem;/);
  assert.match(view, /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.options-cell\s*\{[\s\S]*?flex:\s*1 1 100%;/);
  assert.match(view, /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.options-cell \+ \.options-cell\s*\{[\s\S]*?padding-left:\s*0;[\s\S]*?border-left:\s*0;/);
  assert.match(view, /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.action-pill\s*\{[\s\S]*?flex-direction:\s*column;[\s\S]*?align-items:\s*stretch;/);
  assert.match(view, /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.submit-button\s*\{[\s\S]*?width:\s*100%;/);
});

test('upload preview and metadata blocks avoid oversized mobile heights', () => {
  assert.match(view, /\.preview-stage\s*\{[\s\S]*?min-height:\s*clamp\(18rem,\s*58svh,\s*30rem\);/);
  assert.match(view, /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.preview-stage\s*\{[\s\S]*?min-height:\s*clamp\(16rem,\s*52svh,\s*24rem\);/);
  assert.match(view, /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.preview-caption\s*\{[\s\S]*?align-items:\s*flex-start;[\s\S]*?flex-direction:\s*column;/);
  assert.match(view, /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.map-coords\s*\{[\s\S]*?grid-template-columns:\s*1fr;/);
});

test('upload footer uses an upload action label instead of debug FormData copy', () => {
  assert.match(view, /上传图片/);
  assert.doesNotMatch(view, /打印 FormData|FormData 已打印到控制台/);
});

test('upload page calls the real upload API instead of console-only FormData logging', () => {
  assert.match(view, /import \{ useUploadProcessing \} from '\.\/useUploadProcessing'/);
  assert.match(uploadProcessing, /import\s+\{\s*retryTelegramArchive,\s*uploadImage\s*\}\s+from\s+'\.\/upload\.api'/);
  assert.match(uploadProcessing, /await\s+uploadImage\(formData\)/);
  assert.doesNotMatch(view, /console\.group|console\.log|console\.groupEnd/);
});

test('upload page stays on the upload screen and stores results on each queue entry', () => {
  assert.doesNotMatch(view, /useRouter|router\.push/);
  assert.match(uploadQueue, /uploadResult:\s*ImageRecord\s*\|\s*null/);
  assert.match(uploadProcessing, /entry\.uploadResult\s*=\s*record/);
  assert.match(uploadProcessing, /entry\.uploadResult\s*=\s*existing/);
  assert.match(view, /useUploadQueue\(\)/);
});

test('upload page surfaces Telegram archive status after fast upload responses', () => {
  assert.match(uploadProcessing, /import\s+\{\s*checkAdminImageHash,\s*fetchAdminImage\s*\}\s+from\s+'@\/features\/images\/images\.api'/);
  assert.match(uploadProcessing, /const\s+TELEGRAM_ARCHIVE_POLL_ATTEMPTS\s*=\s*60/);
  assert.match(uploadProcessing, /const\s+watchTelegramArchive\s*=\s*async\s*\(entry:\s*UploadEntry,\s*key:\s*string\)/);
  assert.match(uploadProcessing, /latest\.tg_status/);
  assert.match(uploadProcessing, /entry\.uploadResult\s*=\s*\{\s*\.\.\.entry\.uploadResult,\s*tg_status:\s*latest\.tg_status\s*\}/);
  assert.match(uploadProcessing, /void\s+watchTelegramArchive\(entry,\s*record\.key\)/);
  assert.match(view, /archiveStatusLabel\(currentEntry\)/);
  assert.match(uploadArchiveStatus, /已上传，原图归档中/);
  assert.match(uploadArchiveStatus, /已上传，原图已归档/);
  assert.match(uploadArchiveStatus, /已上传，原图归档失败/);
  assert.match(uploadArchiveStatus, /归档中/);
  assert.match(uploadArchiveStatus, /已归档/);
});

test('upload page uses admin API helpers and paths', () => {
  assert.match(view, /import \{ fetchAdminFolders, type FolderRecord \} from '@\/features\/library\/library\.api'/);
  assert.match(view, /folders\.value = await fetchAdminFolders\(\)/);
  assert.match(uploadProcessing, /const latest = await fetchAdminImage\(key\)/);
  assert.match(uploadProcessing, /const existing = await checkAdminImageHash\(hash\)/);
  assert.match(uploadApi, /fetch\('\/api\/admin\/upload'/);
  assert.match(aiPreviewApi, /export \{ previewAiAnnotation \} from '@\/features\/images\/ai-preview\.api'/);
  assert.match(imagesAiPreviewApi, /fetch\('\/api\/admin\/ai\/preview'/);
  assert.match(geocodeApi, /fetch\(`\/api\/admin\/geocode\?\$\{params\.toString\(\)\}`\)/);
});

test('upload page keeps Telegram archive polling alive for slow archive results', () => {
  assert.match(uploadProcessing, /const\s+TELEGRAM_ARCHIVE_POLL_ATTEMPTS\s*=\s*60/);
  assert.doesNotMatch(uploadProcessing, /catch\s*\{\s*return;\s*\}/);
  assert.match(uploadProcessing, /catch\s*\{\s*continue;\s*\}/);
});

test('upload page can retry failed Telegram archive with the local original file', () => {
  assert.match(uploadQueue, /archiveRetrying:\s*boolean/);
  assert.match(uploadQueue, /archiveRetryError:\s*string\s*\|\s*null/);
  assert.match(uploadProcessing, /const\s+retryArchiveForCurrent\s*=\s*async\s*\(\)/);
  assert.match(uploadProcessing, /await\s+retryTelegramArchive\(entry\.uploadResult\.key,\s*entry\.file\)/);
  assert.match(uploadProcessing, /void\s+watchTelegramArchive\(entry,\s*record\.key\)/);
  assert.match(view, /重试归档/);
  assert.match(view, /archive-retry-button/);
  assert.match(view, /archiveRetryError/);
});

test('upload page submits compressed image dimensions with the form data', () => {
  assert.match(uploadProcessing, /readImageDimensions\(nextCompressed\)/);
  assert.match(uploadProcessing, /entry\.compressedDimensions\s*=\s*nextDimensions/);
  assert.match(uploadProcessing, /buildUploadFormData\(\{\s*original:\s*entry\.file,[\s\S]*dimensions:\s*entry\.compressedDimensions,/);
});

test('upload page runs AI preview after compression and keeps fields editable', () => {
  assert.match(uploadProcessing, /import\s+\{\s*previewAiAnnotation\s*\}\s+from\s+'\.\/ai-preview\.api'/);
  assert.match(uploadQueue, /aiRequestId:\s*number/);
  assert.match(uploadProcessing, /const\s+runAiPreview\s*=\s*async\s*\(entry:\s*UploadEntry\)/);
  assert.match(uploadProcessing, /const\s+requestId\s*=\s*\+\+entry\.aiRequestId/);
  assert.match(uploadProcessing, /enqueueAi\(entry\)/);
  assert.match(view, /triggerAiForCurrent/);
  assert.match(view, /重新 AI 分析/);
  assert.match(view, /v-model="displayEntry\.meta\.tags"/);
  assert.match(view, /v-model="displayEntry\.meta\.search_content"/);
  assert.match(view, /v-model="displayEntry\.meta\.dominant_color"/);
  assert.match(view, /v-model="displayEntry\.meta\.palette"/);
  assert.match(view, /v-model="displayEntry\.meta\.composition"/);
  assert.match(uploadProcessing, /entry\.meta\.dominant_color\s*=\s*result\.dominant_color/);
  assert.match(uploadProcessing, /entry\.meta\.palette\s*=\s*result\.palette\.join\(', '\)/);
  assert.match(uploadProcessing, /entry\.meta\.composition\s*=\s*result\.composition/);
  assert.doesNotMatch(view, /v-model="meta\.ocr_text"/);
  assert.doesNotMatch(view, /<span class="field-label">OCR<\/span>/);
  assert.match(uploadProcessing, /entry\.meta\.ai_status\s*=\s*'done'/);
});

test('upload page limits processing AI and upload concurrency instead of serializing whole batches', () => {
  assert.match(uploadProcessing, /const\s+PROCESS_CONCURRENCY\s*=\s*2/);
  assert.match(uploadProcessing, /const\s+AI_CONCURRENCY\s*=\s*2/);
  assert.match(uploadProcessing, /const\s+UPLOAD_CONCURRENCY\s*=\s*2/);
  assert.match(uploadProcessing, /let\s+processWorkers\s*=\s*0/);
  assert.match(uploadProcessing, /processWorkers\s*<\s*PROCESS_CONCURRENCY/);
  assert.match(uploadProcessing, /let\s+aiWorkers\s*=\s*0/);
  assert.match(uploadProcessing, /aiWorkers\s*<\s*AI_CONCURRENCY/);
  assert.match(uploadProcessing, /aiQueue\.some\(\(queued\)\s*=>\s*queued\.id\s*===\s*entry\.id\)/);
  assert.match(uploadProcessing, /runConcurrentEntries\(uploadCandidates,\s*UPLOAD_CONCURRENCY,\s*uploadEntry\)/);
  assert.doesNotMatch(view, /for\s*\(const entry of entries\.value\)\s*\{\s*if\s*\(entry\.status !== 'ready'\) continue;\s*await uploadEntry\(entry\);/);
});

test('upload page sends a smaller derived image to AI preview', () => {
  assert.match(uploadProcessing, /const\s+AI_PREVIEW_MAX_EDGE\s*=\s*1280/);
  assert.match(uploadProcessing, /const\s+AI_PREVIEW_RECOMPRESS_BYTES\s*=\s*768\s*\*\s*1024/);
  assert.match(uploadQueue, /aiPreviewFile:\s*File\s*\|\s*null/);
  assert.match(uploadProcessing, /const\s+prepareAiPreviewFile\s*=\s*async\s*\(file:\s*File\):\s*Promise<File>/);
  assert.match(uploadProcessing, /maxWidthOrHeight:\s*AI_PREVIEW_MAX_EDGE/);
  assert.match(uploadProcessing, /initialQuality:\s*0\.72/);
  assert.match(uploadProcessing, /entry\.aiPreviewFile\s*=\s*aiImage/);
  assert.match(uploadProcessing, /previewAiAnnotation\(aiImage\)/);
});

test('upload duplicate check failure is not silently treated as a new image', () => {
  assert.doesNotMatch(uploadProcessing, /checkAdminImageHash\(hash\)\.catch\(\(\)\s*=>\s*null\)/);
  assert.match(uploadProcessing, /const existing = await checkAdminImageHash\(hash\)/);
});

test('upload location region follows the selected region while EXIF can detect overseas coordinates', () => {
  assert.doesNotMatch(view, /mapRegionForStoredCoordinate/);
  assert.match(view, /import \{ useUploadPickMap \} from '\.\/useUploadPickMap'/);
  assert.match(uploadProcessing, /import \{ geocodeRegionForCoordinate \} from '\.\/useUploadPickMap'/);
  assert.match(uploadPickMap, /export const regionFromPickRegion = \(region: GeocodeRegion\): MapRegion => \(region === 'cn' \? 'china' : 'global'\)/);
  assert.match(uploadPickMap, /export const searchRegionFromMapRegion = \(region: MapRegion \| null \| undefined\): GeocodeRegion =>/);
  assert.match(uploadPickMap, /region: GeocodeRegion = pickRegion\.value/);
  assert.match(uploadPickMap, /entry\.meta\.location_region = lat === null \|\| lng === null \? null : regionFromPickRegion\(region\)/);
  assert.match(uploadPickMap, /export const geocodeRegionForCoordinate = \(lat: number, lng: number\): GeocodeRegion =>/);
  assert.match(uploadProcessing, /setEntryCoordinates\(\s*entry,\s*nextExif\.location_lat,\s*nextExif\.location_lng,\s*entry\.id === currentEntryId\.value,\s*exifRegion,\s*\)/);
});

test('upload queue selection restores the picker region from the selected entry', () => {
  assert.match(uploadPickMap, /const syncPickRegionFromEntry = async \(entry: Entry \| null\) => \{/);
  assert.match(uploadPickMap, /const nextRegion = searchRegionFromMapRegion\(entry\?\.meta\.location_region\)/);
  assert.match(uploadPickMap, /if \(nextRegion === pickRegion\.value\) return;/);
  assert.match(uploadPickMap, /pickRegion\.value = nextRegion;\s*await remountMap\(\);/);
  assert.match(uploadFileSelection, /const entry = entries\.value\.find\(\(item\) => item\.id === entryId\) \?\? null;[\s\S]*currentEntryId\.value = entryId;[\s\S]*void syncPickRegionFromEntry\(entry\);/);
  assert.match(uploadFileSelection, /currentEntryId\.value = nextEntry\?\.id \?\? null;\s*void syncPickRegionFromEntry\(nextEntry\);/);
  assert.match(uploadFileSelection, /currentEntryId\.value = null;\s*void syncPickRegionFromEntry\(null\);/);
});

test('upload location region controls do not render implementation-source hint text', () => {
  assert.doesNotMatch(view, /国内走高德、国外走 Mapbox/);
  assert.doesNotMatch(view, /class="region-hint"/);
  assert.doesNotMatch(view, /\.region-hint\s*\{/);
});

test('upload location region uses only the search region toggle', () => {
  assert.doesNotMatch(view, /class="map-region-row"/);
  assert.doesNotMatch(view, />归属区域</);
  assert.doesNotMatch(view, /class="region-button"/);
  assert.doesNotMatch(view, /const setEntryRegion/);
});

test('upload folder loading errors are visible instead of silently falling back', () => {
  assert.match(view, /globalError\.value = `文件夹加载失败：\$\{\(error as Error\)\.message\}`/);
  assert.doesNotMatch(view, /拉不到不阻塞上传/);
});

test('upload exif date and camera each span a full row', () => {
  assert.match(view, /<div class="meta-row exif-row-wide">\s*<dt>拍摄时间<\/dt>/);
  assert.match(view, /<div class="meta-row exif-row-wide">\s*<dt>相机<\/dt>/);

  const styleBlock = extract('.exif-row-wide {', '\n}\n\n.meta-row');
  assert.match(styleBlock, /grid-column:\s*1\s*\/\s*-1/);
});
