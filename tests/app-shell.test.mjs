import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const shell = readFileSync('src/shared/ui/AppShell.vue', 'utf8');
const router = readFileSync('src/app/router.ts', 'utf8');
const i18nPath = 'src/shared/i18n/useLanguage.ts';
const legacyPath = ['/', 'h', 'ive'].join('');
const legacyIcon = ['h', 'ive'].join('');
const legacyView = `${legacyIcon[0].toUpperCase()}${legacyIcon.slice(1)}View`;
const legacyTitle = '\u8702\u5de2';

const extractNavLinks = (name) => {
  const match = shell.match(new RegExp(`const ${name}: [^=]+ = \\[([\\s\\S]*?)\\];`));
  assert.ok(match, `${name} declaration missing`);
  return match[1];
};

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

test('AppShell links the footprints nav entry to the footprints route', () => {
  assert.match(shell, /\{\s*to:\s*'\/footprints',\s*label:\s*'足迹',\s*icon:\s*'footprints'\s*\}/);
  assert.doesNotMatch(shell, new RegExp(`${legacyPath}|icon:\\s*'${legacyIcon}'|${legacyTitle}`));
});

test('router title matches the footprints page', () => {
  assert.match(router, /path:\s*'\/footprints'[\s\S]*name:\s*'footprints'[\s\S]*title:\s*'足迹'/);
  assert.match(router, /@\/features\/footprints\/FootprintsView\.vue/);
  assert.doesNotMatch(router, new RegExp(`${legacyPath}|${legacyView}|titleKey|${legacyTitle}`));
});

test('AppShell exposes the library route as the admin console', () => {
  assert.match(shell, /\{\s*to:\s*'\/library',\s*label:\s*'控制台',\s*icon:\s*'sliders'\s*\}/);
  assert.match(shell, /sliders:\s*\{\s*vb:\s*'0 0 512 512'/);
  assert.doesNotMatch(shell, /\{\s*to:\s*'\/library',\s*label:\s*'文件库'/);
});

test('AppShell shows upload only in the admin nav before console', () => {
  const publicNavLinks = extractNavLinks('navLinks');
  const adminNavLinks = extractNavLinks('adminNavLinks');

  assert.doesNotMatch(publicNavLinks, /\{\s*to:\s*'\/upload'/);
  assert.match(
    adminNavLinks,
    /\{\s*to:\s*'\/upload',\s*label:\s*'上传',\s*icon:\s*'upload'\s*\}[\s\S]*\{\s*to:\s*'\/library',\s*label:\s*'控制台'/,
  );
  assert.match(router, /path:\s*'\/upload'[\s\S]*requiresAdmin:\s*true/);
});

test('router keeps /library but titles it as console', () => {
  assert.match(router, /path:\s*'\/library'[\s\S]*title:\s*'控制台'[\s\S]*requiresAdmin:\s*true/);
  assert.doesNotMatch(router, /path:\s*'\/library'[\s\S]*title:\s*'文件库'/);
});

test('language switch code and entry are not kept', () => {
  assert.equal(existsSync(i18nPath), false);
  assert.doesNotMatch(shell, /@click="toggleLanguage"|languageButtonLabel|languageButtonAriaLabel/);
  assert.doesNotMatch(shell, /ICONS\.language|type IconName = [^;]*'language'/);
  assert.doesNotMatch(shell, /from '@\/shared\/i18n\/useLanguage'/);
  assert.doesNotMatch(router, /titleKey|setPageTitle|useLanguage/);
});

test('future placeholder tool buttons are not rendered', () => {
  assert.doesNotMatch(shell, /切换主题（阶段|ICONS\.moon|type IconName = [^;]*'moon'/);
});
