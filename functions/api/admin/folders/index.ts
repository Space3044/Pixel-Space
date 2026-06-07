import type { Env } from '../../../types';
import { resolveAdmin } from '../../../_shared/auth';
import { badRequest, json, serverError, unauthorized } from '../../../_shared/http';
import { LIST_FOLDERS_SQL, normalizeParentId, sanitizeFolderName, type FolderRecord } from '../../../_shared/folders';
import { withRequestLogging } from '../../../_shared/logger';
import { parseJsonObject } from '../../../_shared/request';
import { requireSameOrigin } from '../../../_shared/security';

interface CreatePayload {
  name: string;
  parent_id: string | null;
}

const parseCreatePayload = async (request: Request): Promise<CreatePayload | null> => {
  const raw = await parseJsonObject(request);
  if (!raw) return null;
  const name = sanitizeFolderName(raw.name);
  if (!name) return null;
  const parentId = normalizeParentId(raw.parent_id);
  if (parentId === undefined) return null;
  return { name, parent_id: parentId };
};

const cryptoUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  throw new Error('crypto.randomUUID is unavailable');
};

export const onRequestPost: PagesFunction<Env> = withRequestLogging('/api/admin/folders', async ({ request, env }, logger) => {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  if (!(await resolveAdmin(request, env))) return unauthorized();

  const payload = await parseCreatePayload(request);
  if (!payload) return badRequest('invalid_folder_payload');

  // parent_id 不为 null 时要验证目标父目录存在，避免悬空引用。
  if (payload.parent_id !== null) {
    const parent = await env.DB
      .prepare('SELECT id FROM folders WHERE id = ?')
      .bind(payload.parent_id)
      .first<{ id: string }>();
    if (!parent) return badRequest('parent_not_found');
  }

  const id = cryptoUUID();
  try {
    await env.DB
      .prepare('INSERT INTO folders (id, parent_id, name) VALUES (?, ?, ?)')
      .bind(id, payload.parent_id, payload.name)
      .run();
  } catch (error) {
    const message = (error as Error).message ?? '';
    // SQLite UNIQUE 冲突在 D1 上返回的 message 包含 UNIQUE 关键字。
    if (message.includes('UNIQUE')) return badRequest('name_conflict');
    logger.error('POST /api/admin/folders failed', {
      error,
      context: {
        id,
        parentId: payload.parent_id,
      },
    });
    return serverError('folder_create_failed');
  }

  return json({
    id,
    parent_id: payload.parent_id,
    name: payload.name,
    image_count: 0,
    child_count: 0,
  }, 201);
});

export const onRequestGet: PagesFunction<Env> = withRequestLogging('/api/admin/folders', async ({ env, request }, logger) => {
  if (!(await resolveAdmin(request, env))) return unauthorized();

  try {
    const result = await env.DB.prepare(LIST_FOLDERS_SQL).all<FolderRecord>();
    return json({ folders: result.results ?? [] });
  } catch (error) {
    logger.error('GET /api/admin/folders failed', { error });
    return serverError('folders_list_failed');
  }
});
