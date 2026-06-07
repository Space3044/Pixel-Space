import type { Env } from '../../../types';
import { resolveAdmin } from '../../../_shared/auth';
import { badRequest, json, notFound, serverError, unauthorized } from '../../../_shared/http';
import { withRequestLogging } from '../../../_shared/logger';
import { normalizeFutureIso } from '../../../_shared/download-grants';
import { requireSameOrigin } from '../../../_shared/security';
import { parseJsonObject, stringOrNull } from '../../../_shared/request';

const grantIdFromParams = (params: EventContext<Env, string, unknown>['params']): string | null => {
  const id = params.id;
  return typeof id === 'string' && id.trim() ? id : null;
};

export const onRequestPatch: PagesFunction<Env> = withRequestLogging('/api/admin/download-grants/:id', async ({ request, env, params }, logger) => {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  if (!(await resolveAdmin(request, env))) return unauthorized();

  const id = grantIdFromParams(params);
  if (!id) return badRequest('invalid_download_grant_id');

  const raw = await parseJsonObject(request);
  const expiresAt = stringOrNull(raw?.expires_at);
  const normalized = expiresAt ? normalizeFutureIso(expiresAt) : null;
  if (!normalized) return badRequest('invalid_expiration');

  try {
    const result = await env.DB
      .prepare('UPDATE download_grants SET expires_at = ? WHERE id = ?')
      .bind(normalized, id)
      .run();

    if ((result.meta?.changes ?? 0) === 0) return notFound('download_grant_not_found');
    return json({ id, expires_at: normalized });
  } catch (error) {
    logger.error('PATCH /api/admin/download-grants/:id failed', {
      error,
      context: { id },
    });
    return serverError('download_grant_update_failed');
  }
});

export const onRequestDelete: PagesFunction<Env> = withRequestLogging('/api/admin/download-grants/:id', async ({ request, env, params }, logger) => {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  if (!(await resolveAdmin(request, env))) return unauthorized();

  const id = grantIdFromParams(params);
  if (!id) return badRequest('invalid_download_grant_id');

  try {
    const result = await env.DB.prepare('DELETE FROM download_grants WHERE id = ?').bind(id).run();
    if ((result.meta?.changes ?? 0) === 0) return notFound('download_grant_not_found');
    return json({ ok: true, id });
  } catch (error) {
    logger.error('DELETE /api/admin/download-grants/:id failed', {
      error,
      context: { id },
    });
    return serverError('download_grant_delete_failed');
  }
});
