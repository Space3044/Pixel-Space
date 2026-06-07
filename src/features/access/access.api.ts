import type { ImageRecord } from '@/features/images/image.types';
import { fetchJson, readHttpError } from '@/shared/api/http';

export interface VerifyDownloadGrantResponse {
  expires_at: string;
  images: ImageRecord[];
}

export function verifyDownloadGrant(code: string, turnstileToken?: string): Promise<VerifyDownloadGrantResponse> {
  return fetchJson<VerifyDownloadGrantResponse>('/api/download-grants/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, turnstileToken }),
  });
}

export async function downloadGrantOriginal(key: string, code: string): Promise<Blob> {
  const response = await fetch(`/api/download-grants/original/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!response.ok) {
    throw new Error(`download original failed: ${await readHttpError(response)}`);
  }
  return response.blob();
}
