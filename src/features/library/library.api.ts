// 文件库前端 API 封装。所有写操作都打在 /api/admin/* 之下，自动接受 useAdmin 注入的 X-Dev-Role。

import type { ImageRecord } from '@/features/images/image.types';
import { fetchJson as jsonFetch } from '@/shared/api/http';

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
  failed: string[];
}

export interface AiSettings {
  proxy_url: string;
  model: string;
  prompt: string;
}

export interface CreateDownloadGrantPayload {
  keys: string[];
  expires_at: string;
}

export interface CreateDownloadGrantResponse {
  code: string;
  expires_at: string;
  image_count: number;
  access_url: string;
}

export interface DownloadGrantRecord {
  id: string;
  code: string;
  expires_at: string;
  created_at: string;
  image_count: number;
  images: ImageRecord[];
}

interface DownloadGrantsResponse {
  grants: DownloadGrantRecord[];
}

export interface UpdateDownloadGrantPayload {
  expires_at: string;
}

export interface UpdateDownloadGrantResponse {
  id: string;
  expires_at: string;
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

export function createDownloadGrant(payload: CreateDownloadGrantPayload): Promise<CreateDownloadGrantResponse> {
  return jsonFetch<CreateDownloadGrantResponse>('/api/admin/download-grants', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function fetchDownloadGrants(): Promise<DownloadGrantRecord[]> {
  return jsonFetch<DownloadGrantsResponse>('/api/admin/download-grants').then((data) => data.grants);
}

export function updateDownloadGrant(
  id: string,
  payload: UpdateDownloadGrantPayload,
): Promise<UpdateDownloadGrantResponse> {
  return jsonFetch<UpdateDownloadGrantResponse>(`/api/admin/download-grants/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function deleteDownloadGrant(id: string): Promise<void> {
  return jsonFetch<{ ok: boolean }>(`/api/admin/download-grants/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }).then(() => undefined);
}

// 借用 list API（管理员视角拿全量）；前端按 folder_id 自己过滤当前目录。
