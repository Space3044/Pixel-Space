import type { ImageRecord } from '@/features/images/image.types';
import { readHttpError } from '@/shared/api/http';

export async function uploadImage(formData: FormData): Promise<ImageRecord> {
  const response = await fetch('/api/admin/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`上传失败：${await readHttpError(response)}`);
  }

  return (await response.json()) as ImageRecord;
}

export async function retryTelegramArchive(key: string, original: File): Promise<ImageRecord> {
  const formData = new FormData();
  formData.set('original', original);

  const response = await fetch(`/api/admin/image/${encodeURIComponent(key)}/archive`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`归档重试失败：${await readHttpError(response)}`);
  }

  return (await response.json()) as ImageRecord;
}
