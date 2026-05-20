import type { ImageRecord } from './image.types';

const API_BASE = '/api';

export interface ImageUpdatePayload {
  title: string;
  caption: string;
  location_name: string;
  location_lat: number | null;
  location_lng: number | null;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`fetch ${path} failed: ${response.status} ${text}`);
  }
  return (await response.json()) as T;
}

export function listImages(query = ''): Promise<ImageRecord[]> {
  const trimmed = query.trim();
  if (!trimmed) return fetchJson<ImageRecord[]>('/list');
  const params = new URLSearchParams({ q: trimmed });
  return fetchJson<ImageRecord[]>(`/list?${params.toString()}`);
}

export function fetchImage(key: string): Promise<ImageRecord> {
  return fetchJson<ImageRecord>(`/image/${encodeURIComponent(key)}`);
}

export function updateImage(key: string, payload: ImageUpdatePayload): Promise<ImageRecord> {
  return fetchJson<ImageRecord>(`/admin/image/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function deleteImage(key: string): Promise<void> {
  return fetchJson<{ ok: boolean; key: string }>(`/admin/image/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  }).then(() => undefined);
}
