import assert from 'node:assert/strict';
import { useUploadQueue } from '../src/features/upload/useUploadQueue.ts';

const test = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

const makeFile = (name) => new File(['image-bytes'], name, { type: 'image/jpeg' });

test('useUploadQueue centralizes queue state and progress labels', () => {
  const queue = useUploadQueue({
    createObjectUrl: (file) => `blob:${file.name}`,
  });
  const entry = queue.createEntry(makeFile('cat.jpg'));

  assert.equal(entry.previewUrl, 'blob:cat.jpg');
  assert.equal(entry.meta.title, 'cat');
  assert.equal(queue.queueCountLabel.value, '空');
  assert.equal(queue.statusLabel.value, '等待选择图片');
  assert.equal(queue.statusVariant.value, 'is-idle');

  queue.entries.value.push(entry);
  queue.currentEntryId.value = entry.id;
  const storedEntry = queue.entries.value[0];

  assert.equal(queue.currentEntry.value, storedEntry);
  assert.equal(queue.displayEntry.value, storedEntry);
  assert.equal(queue.hasEntries.value, true);
  assert.equal(queue.queueCountLabel.value, '1 张');
  assert.equal(queue.statusLabel.value, '处理图片中… 1 张');
  assert.equal(queue.taskProgressStatus.value, 'loading');

  storedEntry.status = 'ready';

  assert.equal(queue.canSubmit.value, true);
  assert.equal(queue.statusLabel.value, '准备就绪，可上传 1 张');
  assert.equal(queue.statusVariant.value, 'is-pending');
  assert.equal(queue.taskProgressValue.value, 1);

  queue.isBatchUploading.value = true;
  storedEntry.status = 'uploading';

  assert.equal(queue.statusLabel.value, '正在上传 0/1');
  assert.equal(queue.taskProgressMax.value, 1);

  queue.isBatchUploading.value = false;
  storedEntry.status = 'done';
  storedEntry.duplicate = true;
  storedEntry.uploadResult = { key: 'images/cat' };

  assert.equal(queue.doneEntries.value.length, 1);
  assert.equal(queue.duplicateEntries.value.length, 1);
  assert.equal(queue.statusLabel.value, '全部完成（1 张已存在）');
  assert.equal(queue.taskProgressStatus.value, 'success');
});
