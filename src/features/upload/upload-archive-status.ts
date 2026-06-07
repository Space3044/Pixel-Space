import type { UploadEntry } from './useUploadQueue';

type ArchiveStatusEntry = Pick<UploadEntry, 'archiveRetrying' | 'uploadResult'>;

export const archiveStatusLabel = (entry: ArchiveStatusEntry): string => {
  if (entry.archiveRetrying) return '正在重试原图归档';
  if (entry.uploadResult?.tg_status === 'pending') return '已上传，原图归档中';
  if (entry.uploadResult?.tg_status === 'done') return '已上传，原图已归档';
  if (entry.uploadResult?.tg_status === 'failed') return '已上传，原图归档失败';
  return '已上传';
};

export const archiveStatusClass = (entry: ArchiveStatusEntry): string => {
  if (entry.archiveRetrying) return 'preview-busy';
  if (entry.uploadResult?.tg_status === 'failed') return 'preview-error';
  if (entry.uploadResult?.tg_status === 'pending') return 'preview-busy';
  return 'preview-ok';
};

export const archiveThumbLabel = (entry: ArchiveStatusEntry): string => {
  if (entry.archiveRetrying) return '重试中';
  if (entry.uploadResult?.tg_status === 'pending') return '归档中';
  if (entry.uploadResult?.tg_status === 'done') return '已归档';
  if (entry.uploadResult?.tg_status === 'failed') return '归档失败';
  return '已上传';
};

export const archiveThumbClass = (entry: ArchiveStatusEntry): string => {
  if (entry.archiveRetrying) return 'is-busy';
  if (entry.uploadResult?.tg_status === 'failed') return 'is-error';
  if (entry.uploadResult?.tg_status === 'pending') return 'is-busy';
  return 'is-ok';
};
