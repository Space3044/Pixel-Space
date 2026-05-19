import type { ImageRecord } from '@/features/images/image.types';

export async function uploadImage(formData: FormData): Promise<ImageRecord> {
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const data = (await response.json()) as { error?: unknown };
      if (typeof data.error === 'string') message = data.error;
    } catch {
      const text = await response.text().catch(() => '');
      if (text) message = text;
    }
    throw new Error(`上传失败：${message}`);
  }

  return (await response.json()) as ImageRecord;
}
