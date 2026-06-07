import assert from 'node:assert/strict';
import {
  archiveStatusClass,
  archiveStatusLabel,
  archiveThumbClass,
  archiveThumbLabel,
} from '../src/features/upload/upload-archive-status.ts';

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const entry = (tgStatus, overrides = {}) => ({
  archiveRetrying: false,
  uploadResult: tgStatus ? { tg_status: tgStatus } : null,
  ...overrides,
});

test('upload archive status helpers format main labels and classes', () => {
  assert.equal(archiveStatusLabel(entry(null)), '已上传');
  assert.equal(archiveStatusLabel(entry('pending')), '已上传，原图归档中');
  assert.equal(archiveStatusLabel(entry('done')), '已上传，原图已归档');
  assert.equal(archiveStatusLabel(entry('failed')), '已上传，原图归档失败');
  assert.equal(archiveStatusLabel(entry('failed', { archiveRetrying: true })), '正在重试原图归档');

  assert.equal(archiveStatusClass(entry('pending')), 'preview-busy');
  assert.equal(archiveStatusClass(entry('failed')), 'preview-error');
  assert.equal(archiveStatusClass(entry('done')), 'preview-ok');
});

test('upload archive status helpers format queue thumb labels and classes', () => {
  assert.equal(archiveThumbLabel(entry(null)), '已上传');
  assert.equal(archiveThumbLabel(entry('pending')), '归档中');
  assert.equal(archiveThumbLabel(entry('done')), '已归档');
  assert.equal(archiveThumbLabel(entry('failed')), '归档失败');
  assert.equal(archiveThumbLabel(entry('failed', { archiveRetrying: true })), '重试中');

  assert.equal(archiveThumbClass(entry('pending')), 'is-busy');
  assert.equal(archiveThumbClass(entry('failed')), 'is-error');
  assert.equal(archiveThumbClass(entry('done')), 'is-ok');
});
