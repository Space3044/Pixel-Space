import type { ImageRecord } from './image.types';
import { fetchJson, readHttpError } from '@/shared/api/http';

const API_BASE = '/api';

export interface ImageUpdatePayload {
  title: string;
  caption: string;
  location_name: string;
  location_lat: number | null;
  location_lng: number | null;
  location_region: string | null;
  tags: string;
  dominant_color: string;
  palette: string;
  composition: string;
  is_public: 0 | 1;
  location_public: 0 | 1;
}

const apiPath = (path: string) => `${API_BASE}${path}`;

export interface ListImagesOptions {
  // null 表示「未分类（folder_id IS NULL）」；undefined 表示不过滤。
  folderId?: string | null;
  // 是否递归把子目录的图也带回来。默认 true，符合「进文件夹能看到所有后代图」的直觉。
  recursive?: boolean;
}

export function listImages(query = '', options: ListImagesOptions = {}): Promise<ImageRecord[]> {
  const params = new URLSearchParams();
  const trimmed = query.trim();
  if (trimmed) params.set('q', trimmed);
  if (options.folderId === null) {
    params.set('folder', '__none__');
  } else if (typeof options.folderId === 'string' && options.folderId) {
    params.set('folder', options.folderId);
    if (options.recursive === false) params.set('recursive', '0');
  }
  const qs = params.toString();
  return fetchJson<ImageRecord[]>(apiPath(qs ? `/list?${qs}` : '/list'));
}

export function fetchImage(key: string): Promise<ImageRecord> {
  return fetchJson<ImageRecord>(apiPath(`/image/${encodeURIComponent(key)}`));
}

export async function checkImageHash(hash: string): Promise<ImageRecord | null> {
  const response = await fetch(apiPath(`/check-hash?hash=${encodeURIComponent(hash)}`));
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`check-hash failed: ${await readHttpError(response)}`);
  }
  return (await response.json()) as ImageRecord;
}

export function updateImage(key: string, payload: ImageUpdatePayload): Promise<ImageRecord> {
  return fetchJson<ImageRecord>(apiPath(`/admin/image/${encodeURIComponent(key)}`), {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function deleteImage(key: string): Promise<void> {
  return fetchJson<{ ok: boolean; key: string }>(apiPath(`/admin/image/${encodeURIComponent(key)}`), {
    method: 'DELETE',
  }).then(() => undefined);
}
