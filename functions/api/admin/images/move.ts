import type { Env } from '../../../types';
import { resolveAdmin } from '../../../_shared/auth';
import { badRequest, json, serverError, unauthorized } from '../../../_shared/http';

// 批量把一组图片移动到目标 folder_id（null 表示根 / 未分类）。
// 单次最多 200 张，超出请前端分片调用。

interface MovePayload {
  keys: string[];
  folder_id: string | null;
}

const MAX_BATCH = 200;

const parsePayload = async (request: Request): Promise<MovePayload | null> => {
  let raw: Record<string, unknown>;
  try {
    const data = (await request.json()) as unknown;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    raw = data as Record<string, unknown>;
  } catch {
    return null;
  }

  const keysRaw = raw.keys;
  if (!Array.isArray(keysRaw) || keysRaw.length === 0 || keysRaw.length > MAX_BATCH) return null;
  const keys: string[] = [];
  for (const value of keysRaw) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    keys.push(trimmed);
  }

  const folderRaw = raw.folder_id;
  let folderId: string | null = null;
  if (folderRaw === null || folderRaw === undefined || folderRaw === '') {
    folderId = null;
  } else if (typeof folderRaw === 'string') {
    folderId = folderRaw.trim() || null;
  } else {
    return null;
  }

  return { keys, folder_id: folderId };
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!resolveAdmin(request, env)) return unauthorized();

  const payload = await parsePayload(request);
  if (!payload) return badRequest('invalid_move_payload');

  if (payload.folder_id !== null) {
    const folder = await env.DB
      .prepare('SELECT id FROM folders WHERE id = ?')
      .bind(payload.folder_id)
      .first<{ id: string }>();
    if (!folder) return badRequest('folder_not_found');
  }

  try {
    const placeholders = payload.keys.map(() => '?').join(',');
    const result = await env.DB
      .prepare(
        `UPDATE images SET folder_id = ?, updated_at = datetime('now') WHERE key IN (${placeholders})`,
      )
      .bind(payload.folder_id, ...payload.keys)
      .run();

    return json({
      ok: true,
      moved: result.meta?.changes ?? 0,
      folder_id: payload.folder_id,
    });
  } catch (error) {
    console.error('POST /api/admin/images/move failed', error);
    return serverError('images_move_failed');
  }
};
