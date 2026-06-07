import type { Env } from '../types';
import { badRequest, json, notFound, serverError, unauthorized } from './http';
import type { RequestLogger } from './logger';
import { resolveAdmin } from './auth';
import type { ImageRow } from './images';
import { IMAGE_SELECT_COLUMNS, rowToRecord } from './images';

const SELECT_BY_HASH_SQL =
  `SELECT ${IMAGE_SELECT_COLUMNS} FROM images WHERE hash = ? LIMIT 1`;

const HASH_PATTERN = /^[0-9a-f]{64}$/;

export const handleCheckHashGet = async (
  { env, request }: EventContext<Env, string, Record<string, unknown>>,
  logger: RequestLogger,
): Promise<Response> => {
  if (!(await resolveAdmin(request, env))) return unauthorized();

  const hash = (new URL(request.url).searchParams.get('hash') ?? '').trim().toLowerCase();
  if (!HASH_PATTERN.test(hash)) return badRequest('invalid_hash');

  try {
    const row = await env.DB.prepare(SELECT_BY_HASH_SQL).bind(hash).first<ImageRow>();
    if (!row) return notFound('hash_not_found');
    return json(rowToRecord(row, env.PUBLIC_BASE_URL));
  } catch (error) {
    logger.error('GET /api/admin/check-hash failed', {
      error,
      context: { hash },
    });
    return serverError('check_hash_failed');
  }
};
