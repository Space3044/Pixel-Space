import type { Env } from '../../types';
import { notFound, serverError, unauthorized } from '../../_shared/http';
import { withRequestLogging, type RequestLogger } from '../../_shared/logger';
import { resolveAdmin } from '../../_shared/auth';
import { streamTelegramOriginal, type OriginalImageRow } from '../../_shared/original';
import { keyFromRouteParam } from '../../_shared/keys';

const ORIGINAL_SQL = 'SELECT key, title, original_filename, tg_file_id FROM images WHERE key = ?';

interface OriginalRow extends OriginalImageRow {
  title: string;
}

export const handleOriginalGet = async (
  { env, params, request }: EventContext<Env, string, Record<string, unknown>>,
  logger: RequestLogger,
): Promise<Response> => {
  if (!(await resolveAdmin(request, env))) return unauthorized();

  const key = keyFromRouteParam(params.key);
  if (!key) return notFound();

  try {
    const row = await env.DB.prepare(ORIGINAL_SQL).bind(key).first<OriginalRow>();
    if (!row) return notFound();

    const response = await streamTelegramOriginal(env.TG_BOT_TOKEN, row);
    if (!response) return notFound('original_not_archived');

    return response;
  } catch (error) {
    logger.error('GET /api/original/:key failed', {
      error,
      context: { key },
    });
    return serverError('original_failed');
  }
};

export const onRequestGet: PagesFunction<Env> = withRequestLogging('/api/original/:key', handleOriginalGet);
