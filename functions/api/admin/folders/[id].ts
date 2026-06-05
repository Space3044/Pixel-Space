import type { Env } from '../../../types';
import { resolveAdmin } from '../../../_shared/auth';
import { badRequest, json, notFound, serverError, unauthorized } from '../../../_shared/http';
import {
  collectDescendantIds,
  normalizeParentId,
  sanitizeFolderName,
} from '../../../_shared/folders';
import { parseJsonObject } from '../../../_shared/request';

interface PatchPayload {
  name?: string;
  parent_id?: string | null;
}

const parsePatchPayload = async (request: Request): Promise<PatchPayload | null> => {
  const raw = await parseJsonObject(request);
  if (!raw) return null;

  const payload: PatchPayload = {};

  if ('name' in raw) {
    const name = sanitizeFolderName(raw.name);
    if (!name) return null;
    payload.name = name;
  }

  if ('parent_id' in raw) {
    const parentId = normalizeParentId(raw.parent_id);
    if (parentId === undefined) return null;
    payload.parent_id = parentId;
  }

  if (payload.name === undefined && payload.parent_id === undefined) return null;
  return payload;
};

const keyFromParams = (params: EventContext<Env, string, unknown>['params']): string =>
  String(params.id ?? '');

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  if (!resolveAdmin(request, env)) return unauthorized();

  const id = keyFromParams(params);
  if (!id) return notFound();

  const payload = await parsePatchPayload(request);
  if (!payload) return badRequest('invalid_folder_payload');

  const current = await env.DB
    .prepare('SELECT id, parent_id, name FROM folders WHERE id = ?')
    .bind(id)
    .first<{ id: string; parent_id: string | null; name: string }>();
  if (!current) return notFound();

  if (payload.parent_id !== undefined && payload.parent_id !== null) {
    if (payload.parent_id === id) return badRequest('parent_cycle');
    // 检查目标父目录是否落在当前目录的子树内（防止把目录移到自己后代下）。
    const descendants = await collectDescendantIds(env.DB, id);
    if (descendants.has(payload.parent_id)) return badRequest('parent_cycle');
    const parent = await env.DB
      .prepare('SELECT id FROM folders WHERE id = ?')
      .bind(payload.parent_id)
      .first<{ id: string }>();
    if (!parent) return badRequest('parent_not_found');
  }

  const nextName = payload.name ?? current.name;
  const nextParent = payload.parent_id !== undefined ? payload.parent_id : current.parent_id;

  try {
    await env.DB
      .prepare("UPDATE folders SET name = ?, parent_id = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(nextName, nextParent, id)
      .run();
  } catch (error) {
    const message = (error as Error).message ?? '';
    if (message.includes('UNIQUE')) return badRequest('name_conflict');
    console.error(`PATCH /api/admin/folders/${id} failed`, error);
    return serverError('folder_update_failed');
  }

  return json({ id, parent_id: nextParent, name: nextName });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  if (!resolveAdmin(request, env)) return unauthorized();

  const id = keyFromParams(params);
  if (!id) return notFound();

  const current = await env.DB
    .prepare('SELECT id FROM folders WHERE id = ?')
    .bind(id)
    .first<{ id: string }>();
  if (!current) return notFound();

  // 非空目录直接 400，让前端把空目录这个前置条件做掉。
  const childFolder = await env.DB
    .prepare('SELECT id FROM folders WHERE parent_id = ? LIMIT 1')
    .bind(id)
    .first<{ id: string }>();
  if (childFolder) return badRequest('not_empty');

  const childImage = await env.DB
    .prepare('SELECT key FROM images WHERE folder_id = ? LIMIT 1')
    .bind(id)
    .first<{ key: string }>();
  if (childImage) return badRequest('not_empty');

  try {
    await env.DB.prepare('DELETE FROM folders WHERE id = ?').bind(id).run();
    return json({ ok: true, id });
  } catch (error) {
    console.error(`DELETE /api/admin/folders/${id} failed`, error);
    return serverError('folder_delete_failed');
  }
};
