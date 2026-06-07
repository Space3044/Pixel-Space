import type { Env } from '../../../../types';
import { badRequest, json, notFound, serverError, unauthorized } from '../../../../_shared/http';
import { resolveAdmin } from '../../../../_shared/auth';
import { withRequestLogging } from '../../../../_shared/logger';
import type { ImageRow } from '../../../../_shared/images';
import { IMAGE_SELECT_COLUMNS, rowToRecord } from '../../../../_shared/images';
import { keyFromRouteParam } from '../../../../_shared/keys';
import { archiveOriginalAfterUpload, markTelegramArchivePending } from '../../../../_shared/archive';
import { requireSameOrigin } from '../../../../_shared/security';

const MAX_ORIGINAL_BYTES = 50 * 1024 * 1024;

const DETAIL_SQL = `
SELECT ${IMAGE_SELECT_COLUMNS}, hash
FROM images
WHERE key = ?
`;

interface ArchiveImageRow extends ImageRow {
  hash: string;
}

const keyFromParams = (params: EventContext<Env, string, unknown>['params']): string =>
  keyFromRouteParam(params.key);

const sha256Hex = async (file: File): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const originalFromRequest = async (request: Request): Promise<File | null> => {
  const formData = await request.formData();
  const original = formData.get('original');
  return original && typeof original !== 'string' ? original : null;
};

export const onRequestPost: PagesFunction<Env> = withRequestLogging('/api/admin/image/:key/archive', async (context, logger) => {
  const { env, request, params } = context;
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  if (!(await resolveAdmin(request, env))) return unauthorized();

  const key = keyFromParams(params);
  if (!key) return notFound();

  const original = await originalFromRequest(request);
  if (!original || !original.type.startsWith('image/')) return badRequest('invalid_original_file');
  if (original.size > MAX_ORIGINAL_BYTES) return badRequest('original_too_large');

  try {
    const row = await env.DB.prepare(DETAIL_SQL).bind(key).first<ArchiveImageRow>();
    if (!row) return notFound();
    if (row.tg_status !== 'failed') return badRequest('telegram_archive_not_failed');

    const hash = await sha256Hex(original);
    if (hash !== row.hash) return badRequest('original_hash_mismatch');

    await markTelegramArchivePending(env, key);

    const archiveTask = archiveOriginalAfterUpload(env, original, key, logger);
    if (typeof context.waitUntil === 'function') {
      context.waitUntil(archiveTask);
      return json(rowToRecord({ ...row, tg_status: 'pending' }, env.PUBLIC_BASE_URL), 202);
    }

    await archiveTask;
    const updated = await env.DB.prepare(DETAIL_SQL).bind(key).first<ArchiveImageRow>();
    if (!updated) return notFound();
    return json(rowToRecord(updated, env.PUBLIC_BASE_URL));
  } catch (error) {
    logger.error('POST /api/admin/image/:key/archive failed', {
      error,
      context: { key },
    });
    return serverError('telegram_archive_retry_failed');
  }
});
