import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const view = readFileSync('src/features/library/LibraryView.vue', 'utf8');
const api = readFileSync('src/features/library/library.api.ts', 'utf8');
const readme = readFileSync('README.md', 'utf8');
const grantDialog = readFileSync('src/features/library/DownloadGrantDialog.vue', 'utf8');
const grantManager = readFileSync('src/features/library/DownloadGrantManager.vue', 'utf8');
const expiryHelper = readFileSync('src/features/library/download-grant-expiry.ts', 'utf8');

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('LibraryView keeps the original header layout and puts AI settings on the right', () => {
  assert.match(view, /<h1>控制台<\/h1>/);
  assert.match(view, /<header class="library-header">[\s\S]*<div class="library-main">[\s\S]*<nav class="breadcrumb"/);
  assert.match(view, /<header class="library-header">[\s\S]*<aside class="ai-settings-panel" aria-labelledby="ai-settings-title">[\s\S]*<h2 id="ai-settings-title">AI 配置<\/h2>/);
  assert.match(view, /<form class="ai-settings-form" @submit\.prevent="saveAiSettings">/);
  assert.match(view, /v-model="aiSettingsForm\.proxy_url"/);
  assert.match(view, /v-model="aiSettingsForm\.model"/);
  assert.match(view, /v-model="aiSettingsForm\.prompt"/);
  assert.match(view, /<textarea[\s\S]*class="[^"]*settings-textarea[^"]*"[\s\S]*placeholder="编辑图片分析系统提示词"/);
  assert.match(view, /\.library-header\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(view, /\.ai-settings-panel\s*\{[\s\S]*border-left:\s*1px solid rgba\(53,\s*243,\s*255,\s*0\.18\)/);
  assert.match(view, /\.settings-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.45fr\) minmax\(7rem,\s*0\.8fr\)/);
  assert.match(view, /\.ai-settings-form\s*\{[\s\S]*height:\s*100%[\s\S]*min-height:\s*0/);
  assert.match(view, /\.settings-prompt-field\s*\{[\s\S]*flex:\s*1[\s\S]*min-height:\s*0/);
  assert.match(view, /\.settings-textarea\s*\{[\s\S]*resize:\s*none[\s\S]*overflow:\s*auto/);
  assert.doesNotMatch(view, /修改上传分析时使用的代理地址和模型名|\.ai-settings-heading p/);
  assert.doesNotMatch(view, /class="console-section|file-management-section|>文件管理</);
  assert.doesNotMatch(view, /proxy_key|PROXY_KEY/);
});

test('LibraryView loads and saves AI settings through library API helpers', () => {
  assert.match(view, /import \{[\s\S]*fetchAiSettings,[\s\S]*updateAiSettings,[\s\S]*type AiSettings,[\s\S]*\} from '\.\/library\.api'/);
  assert.match(view, /const aiSettingsForm = reactive<AiSettings>\(\{\s*proxy_url:\s*'',\s*model:\s*'',\s*prompt:\s*'',\s*\}\)/);
  assert.match(view, /const aiSettingsSaving = ref\(false\)/);
  assert.match(view, /import \{\s*listAdminImages\s*\} from '@\/features\/images\/images\.api'/);
  assert.match(view, /Promise\.all\(\[\s*fetchAdminFolders\(\),\s*listAdminImages\(\),\s*fetchAiSettings\(\),\s*fetchDownloadGrants\(\),\s*\]\)/);
  assert.match(view, /aiSettingsForm\.proxy_url = aiSettings\.proxy_url/);
  assert.match(view, /aiSettingsForm\.model = aiSettings\.model/);
  assert.match(view, /aiSettingsForm\.prompt = aiSettings\.prompt/);
  assert.match(view, /const saved = await updateAiSettings\(\{\s*proxy_url:\s*aiSettingsForm\.proxy_url,\s*model:\s*aiSettingsForm\.model,\s*prompt:\s*aiSettingsForm\.prompt,\s*\}\)/);
  assert.match(view, /aiSettingsForm\.prompt = saved\.prompt/);
  assert.match(view, /actionMessage\.value = 'AI 配置已保存'/);
});

test('library.api keeps public and admin folder loaders separate', () => {
  assert.match(api, /export function fetchFolders\(\): Promise<FolderRecord\[\]>/);
  assert.match(api, /jsonFetch<FoldersResponse>\('\/api\/folders'\)/);
  assert.match(api, /export function fetchAdminFolders\(\): Promise<FolderRecord\[\]>/);
  assert.match(api, /jsonFetch<FoldersResponse>\('\/api\/admin\/folders'\)/);
});

test('LibraryView renders virtual folders as folder-style cards with image counts', () => {
  assert.match(view, /<div class="library-main">[\s\S]*<div class="library-actions">[\s\S]*<section class="folder-grid shortcut-grid" aria-label="智能目录">[\s\S]*v-for="vf in virtualFolders"[\s\S]*class="folder-card shortcut-card"[\s\S]*<\/section>[\s\S]*<\/div>[\s\S]*<aside class="ai-settings-panel"/);
  assert.match(view, /:class="\{ 'is-active': currentFolderId === vf\.id \}"/);
  assert.match(view, /<div class="folder-icon shortcut-icon" aria-hidden="true">[\s\S]*<svg v-if="vf\.id === VIRTUAL_HIDDEN_IMAGES"[\s\S]*<line x1="2" y1="2" x2="22" y2="22" \/>/);
  assert.match(view, /<p class="folder-name shortcut-name">\{\{ vf\.name \}\}<\/p>[\s\S]*<template v-if="vf\.id === VIRTUAL_DOWNLOAD_GRANTS">\{\{ virtualCounts\[vf\.id\] \}\} 个验证码<\/template>[\s\S]*<template v-else>\{\{ virtualCounts\[vf\.id\] \}\} 张图片<\/template>/);
  assert.match(view, /<section v-if="subfolders\.length > 0" class="folder-grid" aria-label="文件夹">[\s\S]*<article[\s\S]*v-for="folder in subfolders"[\s\S]*class="folder-card"/);
  assert.match(view, /\.shortcut-card\s*\{[\s\S]*border:\s*1px solid rgba\(255,\s*79,\s*216,\s*0\.22\)[\s\S]*color:\s*rgba\(248,\s*207,\s*233,\s*0\.78\)/);
  assert.doesNotMatch(view, /class="library-shortcuts"|class="shortcut-btn"|class="shortcut-count"/);
});

test('LibraryView uses the shared explore image sorting control for each directory', () => {
  assert.match(view, /import SelectPopover from '@\/shared\/ui\/SelectPopover\.vue'/);
  assert.match(view, /import \{ imageSortOptions, sortImagesByMode, type ImageSortMode \} from '@\/features\/images\/image-sort'/);
  assert.match(view, /const sortMode = ref<ImageSortMode>\('created-desc'\)/);
  assert.match(view, /const filteredCurrentImages = computed<ImageRecord\[\]>\(\(\) => \{/);
  assert.match(view, /const currentImages = computed<ImageRecord\[\]>\(\(\) => sortImagesByMode\(filteredCurrentImages\.value, sortMode\.value\)\)/);
  assert.match(view, /<SelectPopover v-model="sortMode" :options="imageSortOptions" aria-label="排序方式">/);
  assert.match(view, /<section v-if="currentImages\.length > 0" class="image-section">[\s\S]*<header class="image-section-header">[\s\S]*<SelectPopover v-model="sortMode" :options="imageSortOptions" aria-label="排序方式">[\s\S]*<\/SelectPopover>/);
});

test('library.api exposes AI settings helpers for proxy URL, model and prompt only', () => {
  assert.match(api, /export interface AiSettings \{\s*proxy_url:\s*string;\s*model:\s*string;\s*prompt:\s*string;\s*\}/);
  assert.match(api, /export function fetchAiSettings\(\): Promise<AiSettings>/);
  assert.match(api, /jsonFetch<AiSettings>\('\/api\/admin\/ai-settings'\)/);
  assert.match(api, /export function updateAiSettings\(payload: AiSettings\): Promise<AiSettings>/);
  assert.match(api, /jsonFetch<AiSettings>\('\/api\/admin\/ai-settings',\s*\{\s*method:\s*'PATCH'/);
  assert.match(api, /body:\s*JSON\.stringify\(payload\)/);
  assert.doesNotMatch(api, /proxy_key|PROXY_KEY/);
});

test('library.api exposes download grant creation helper', () => {
  assert.match(api, /export interface CreateDownloadGrantPayload/);
  assert.match(api, /export interface CreateDownloadGrantResponse/);
  assert.match(api, /export interface DownloadGrantRecord/);
  assert.doesNotMatch(api, /LibraryImage/);
  assert.match(api, /export function createDownloadGrant\(payload: CreateDownloadGrantPayload\): Promise<CreateDownloadGrantResponse>/);
  assert.match(api, /jsonFetch<CreateDownloadGrantResponse>\('\/api\/admin\/download-grants'/);
  assert.match(api, /method:\s*'POST'/);
  assert.match(api, /export function fetchDownloadGrants\(\): Promise<DownloadGrantRecord\[\]>/);
  assert.match(api, /jsonFetch<DownloadGrantsResponse>\('\/api\/admin\/download-grants'\)/);
  assert.match(api, /export function updateDownloadGrant\(\s*id: string,\s*payload: UpdateDownloadGrantPayload,\s*\): Promise<UpdateDownloadGrantResponse>/);
  assert.match(api, /method:\s*'PATCH'/);
  assert.match(api, /export function deleteDownloadGrant\(id: string\): Promise<void>/);
  assert.match(api, /method:\s*'DELETE'/);
});

test('DownloadGrantDialog exposes expiration presets and generated code result', () => {
  assert.match(grantDialog, /DOWNLOAD_GRANT_EXPIRY_OPTIONS/);
  assert.match(grantDialog, /DEFAULT_DOWNLOAD_GRANT_PRESET/);
  assert.match(grantDialog, /buildDownloadGrantExpiry/);
  assert.match(grantDialog, /formatDownloadGrantExpiry/);
  assert.match(grantDialog, /v-for="option in DOWNLOAD_GRANT_EXPIRY_OPTIONS"/);
  assert.match(grantDialog, /type="datetime-local"/);
  assert.match(grantDialog, /生成验证码/);
  assert.match(grantDialog, /复制验证码/);
  assert.match(grantDialog, /复制入口/);
  assert.match(grantDialog, /props\.result\.code/);
  assert.match(grantDialog, /formatDownloadGrantExpiry\(props\.result\.expires_at\)/);
  assert.match(grantDialog, /new URL\(props\.result\.access_url, window\.location\.origin\)\.toString\(\)/);
  assert.match(grantDialog, /const copiedMessage = ref<string \| null>\(null\)/);
  assert.match(grantDialog, /aria-live="polite"/);
  assert.match(expiryHelper, /'1d'/);
  assert.match(expiryHelper, /'7d'/);
  assert.match(expiryHelper, /'30d'/);
});

test('LibraryView opens the download grant dialog from selected images', () => {
  assert.match(view, /import DownloadGrantDialog from '\.\/DownloadGrantDialog\.vue'/);
  assert.match(view, /import DownloadGrantManager from '\.\/DownloadGrantManager\.vue'/);
  assert.match(view, /createDownloadGrant/);
  assert.match(view, /fetchDownloadGrants/);
  assert.match(view, /const grantDialogOpen = ref\(false\)/);
  assert.match(view, /const VIRTUAL_DOWNLOAD_GRANTS = '__download_grants__'/);
  assert.match(view, /name: '验证码管理'/);
  assert.match(view, /downloadGrants\.value = grantList/);
  assert.match(view, /const handleCreateDownloadGrant = async \(expiresAt: string\) =>/);
  assert.match(view, /keys: Array\.from\(selectedKeys\.value\)/);
  assert.match(view, /downloadGrants\.value = await fetchDownloadGrants\(\)/);
  assert.match(view, /<button type="button" class="library-btn primary" @click="grantDialogOpen = true">生成验证码<\/button>/);
  assert.match(view, /<DownloadGrantManager[\s\S]*v-if="currentFolderId === VIRTUAL_DOWNLOAD_GRANTS"[\s\S]*:grants="downloadGrants"[\s\S]*@update="handleUpdateDownloadGrant"[\s\S]*@delete="handleDeleteDownloadGrant"/);
  assert.match(view, /<DownloadGrantDialog/);
  assert.match(view, /@create="handleCreateDownloadGrant"/);
});

test('LibraryView reports batch image delete failures when R2 cleanup preserves records', () => {
  assert.match(api, /failed: string\[\]/);
  assert.match(view, /const failedCount = result\.failed\.length/);
  assert.match(view, /清理失败，已保留记录/);
  assert.match(view, /!result\.failed\.includes\(k\)/);
});

test('DownloadGrantManager shows codes images expiration editing and delete actions', () => {
  assert.match(grantManager, /defineProps<\{\s*grants: DownloadGrantRecord\[\];\s*loadingId: string \| null;\s*error: string \| null;\s*\}>/);
  assert.match(grantManager, /defineEmits<\{\s*update: \[id: string, expiresAt: string\];\s*delete: \[id: string\];\s*\}>/);
  assert.match(grantManager, /formatDownloadGrantExpiry\(grant\.expires_at\)/);
  assert.match(grantManager, /v-for="grant in grants"/);
  assert.match(grantManager, /\{\{ grant\.code \}\}/);
  assert.doesNotMatch(grantManager, /旧记录|无法反推|'is-missing': !grant\.code/);
  assert.match(grantManager, /v-model="expiresAtById\[grant\.id\]"/);
  assert.match(grantManager, /type="datetime-local"/);
  assert.match(grantManager, /@click="emit\('update', grant\.id, expiresAtById\[grant\.id\]\)"/);
  assert.match(grantManager, /@click="emit\('delete', grant\.id\)"/);
  assert.match(grantManager, /v-for="image in grant\.images"/);
  assert.match(grantManager, /image\.original_filename \|\| image\.title \|\| image\.key/);
  assert.match(grantManager, /grant\.image_count/);
});

test('README describes /library as the console instead of a file-library-only page', () => {
  assert.match(readme, /library\/\s+\/library\s+管理员控制台（文件管理 \+ AI 配置）/);
  assert.doesNotMatch(readme, /library\/\s+\/library\s+管理员文件库/);
});
