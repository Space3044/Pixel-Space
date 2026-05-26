// 文件库前端 API 封装。所有写操作都打在 /api/admin/* 之下，自动接受 useAdmin 注入的 X-Dev-Role。

import type { ImageRecord } from '@/features/images/image.types';

export interface FolderRecord {
  id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
  image_count: number;
  child_count: number;
}

interface FoldersResponse {
  folders: FolderRecord[];
}

interface MoveResponse {
  ok: boolean;
  moved: number;
  folder_id: string | null;
}

interface DeleteImagesResponse {
  ok: boolean;
  deleted: number;
  missing: string[];
}

export interface AiSettings {
  proxy_url: string;
  model: string;
  prompt: string;
}

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${path} failed: ${response.status} ${text}`);
  }
  return (await response.json()) as T;
}

export function fetchFolders(): Promise<FolderRecord[]> {
  return jsonFetch<FoldersResponse>('/api/folders').then((data) => data.folders);
}

export function fetchAiSettings(): Promise<AiSettings> {
  return jsonFetch<AiSettings>('/api/admin/ai-settings');
}

export function updateAiSettings(payload: AiSettings): Promise<AiSettings> {
  return jsonFetch<AiSettings>('/api/admin/ai-settings', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function createFolder(payload: { name: string; parent_id: string | null }): Promise<FolderRecord> {
  return jsonFetch<FolderRecord>('/api/admin/folders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function updateFolder(
  id: string,
  payload: { name?: string; parent_id?: string | null },
): Promise<FolderRecord> {
  return jsonFetch<FolderRecord>(`/api/admin/folders/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deleteFolder(id: string): Promise<void> {
  return jsonFetch<{ ok: boolean }>(`/api/admin/folders/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }).then(() => undefined);
}

export function moveImages(payload: { keys: string[]; folder_id: string | null }): Promise<MoveResponse> {
  return jsonFetch<MoveResponse>('/api/admin/images/move', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deleteImages(payload: { keys: string[] }): Promise<DeleteImagesResponse> {
  return jsonFetch<DeleteImagesResponse>('/api/admin/images/delete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// 借用 list API（管理员视角拿全量）；前端按 folder_id 自己过滤当前目录。
// 这里特意复用，避免再给后端开一个按文件夹查询的端点：管理员视角下数据量可控，
// 真要分页可以等到 10k+ 图片再优化。
export type LibraryImage = ImageRecord;
