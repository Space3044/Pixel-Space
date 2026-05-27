import type { ImageRecord } from '@/features/images/image.types';
import { readHttpError } from '@/shared/api/http';

export async function uploadImage(formData: FormData): Promise<ImageRecord> {
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`上传失败：${await readHttpError(response)}`);
  }

  return (await response.json()) as ImageRecord;
}
