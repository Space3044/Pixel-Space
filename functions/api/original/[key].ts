import type { Env } from '../../types';
import { notFound, serverError, unauthorized } from '../../_shared/http';
import { resolveAdmin } from '../../_shared/auth';
import { streamTelegramOriginal, type OriginalImageRow } from '../../_shared/original';
import { keyFromRouteParam } from '../../_shared/keys';

const ORIGINAL_SQL = 'SELECT key, title, original_filename, tg_file_id FROM images WHERE key = ?';

interface OriginalRow extends OriginalImageRow {
  title: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params, request }) => {
  if (!resolveAdmin(request, env)) return unauthorized();

  const key = keyFromRouteParam(params.key);
  if (!key) return notFound();

  try {
    const row = await env.DB.prepare(ORIGINAL_SQL).bind(key).first<OriginalRow>();
    if (!row) return notFound();

    const response = await streamTelegramOriginal(env.TG_BOT_TOKEN, row);
    if (!response) return notFound('original_not_archived');

    return response;
  } catch (error) {
    console.error(`GET /api/original/${key} failed`, error);
    return serverError('original_failed');
  }
};
