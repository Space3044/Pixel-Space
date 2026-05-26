import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const view = readFileSync('src/features/library/LibraryView.vue', 'utf8');
const api = readFileSync('src/features/library/library.api.ts', 'utf8');
const readme = readFileSync('README.md', 'utf8');

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
  assert.match(view, /Promise\.all\(\[\s*fetchFolders\(\),\s*listImages\(\),\s*fetchAiSettings\(\),\s*\]\)/);
  assert.match(view, /aiSettingsForm\.proxy_url = aiSettings\.proxy_url/);
  assert.match(view, /aiSettingsForm\.model = aiSettings\.model/);
  assert.match(view, /aiSettingsForm\.prompt = aiSettings\.prompt/);
  assert.match(view, /const saved = await updateAiSettings\(\{\s*proxy_url:\s*aiSettingsForm\.proxy_url,\s*model:\s*aiSettingsForm\.model,\s*prompt:\s*aiSettingsForm\.prompt,\s*\}\)/);
  assert.match(view, /aiSettingsForm\.prompt = saved\.prompt/);
  assert.match(view, /actionMessage\.value = 'AI 配置已保存'/);
});

test('LibraryView renders virtual folders as folder-style cards with image counts', () => {
  assert.match(view, /<div class="library-main">[\s\S]*<div class="library-actions">[\s\S]*<section class="folder-grid shortcut-grid" aria-label="智能目录">[\s\S]*v-for="vf in virtualFolders"[\s\S]*class="folder-card shortcut-card"[\s\S]*<\/section>[\s\S]*<\/div>[\s\S]*<aside class="ai-settings-panel"/);
  assert.match(view, /:class="\{ 'is-active': currentFolderId === vf\.id \}"/);
  assert.match(view, /<div class="folder-icon shortcut-icon" aria-hidden="true">[\s\S]*<svg v-if="vf\.id === VIRTUAL_HIDDEN_IMAGES"[\s\S]*<line x1="2" y1="2" x2="22" y2="22" \/>/);
  assert.match(view, /<p class="folder-name shortcut-name">\{\{ vf\.name \}\}<\/p>[\s\S]*<p class="folder-meta shortcut-meta">\s*\{\{ virtualCounts\[vf\.id\] \}\} 张图片\s*<\/p>/);
  assert.match(view, /<section v-if="subfolders\.length > 0" class="folder-grid" aria-label="文件夹">[\s\S]*<article[\s\S]*v-for="folder in subfolders"[\s\S]*class="folder-card"/);
  assert.match(view, /\.shortcut-card\s*\{[\s\S]*border:\s*1px solid rgba\(255,\s*79,\s*216,\s*0\.22\)[\s\S]*color:\s*rgba\(248,\s*207,\s*233,\s*0\.78\)/);
  assert.doesNotMatch(view, /class="library-shortcuts"|class="shortcut-btn"|class="shortcut-count"/);
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

test('README describes /library as the console instead of a file-library-only page', () => {
  assert.match(readme, /library\/\s+\/library\s+管理员控制台（文件管理 \+ AI 配置）/);
  assert.doesNotMatch(readme, /library\/\s+\/library\s+管理员文件库/);
});
