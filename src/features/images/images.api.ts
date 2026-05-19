import type { ImageRecord } from './image.types';

const API_BASE = '/api';

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`fetch ${path} failed: ${response.status} ${text}`);
  }
  return (await response.json()) as T;
}

export function listImages(): Promise<ImageRecord[]> {
  return fetchJson<ImageRecord[]>('/list');
}

export function fetchImage(key: string): Promise<ImageRecord> {
  return fetchJson<ImageRecord>(`/image/${encodeURIComponent(key)}`);
}
