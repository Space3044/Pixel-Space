import type { Env } from '../../../types';
import { notFound, serverError } from '../../../_shared/http';
import { parseJsonObject } from '../../../_shared/request';
import { imageBelongsToGrant, resolveActiveGrant } from '../../../_shared/download-grants';
import { streamTelegramOriginal, type OriginalImageRow } from '../../../_shared/original';
import { keyFromRouteParam } from '../../../_shared/keys';

const ORIGINAL_SQL = 'SELECT key, original_filename, tg_file_id FROM images WHERE key = ?';

export const onRequestPost: PagesFunction<Env> = async ({ request, env, params }) => {
  const key = keyFromRouteParam(params.key);
  if (!key) return notFound();

  const raw = await parseJsonObject(request);
  const grant = await resolveActiveGrant(env.DB, raw?.code);
  if (!grant) return notFound('download_grant_not_found');

  try {
    const allowed = await imageBelongsToGrant(env.DB, grant.id, key);
    if (!allowed) return notFound('download_grant_not_found');

    const row = await env.DB.prepare(ORIGINAL_SQL).bind(key).first<OriginalImageRow>();
    if (!row) return notFound();

    const response = await streamTelegramOriginal(env.TG_BOT_TOKEN, row);
    if (!response) return notFound('original_not_archived');

    return response;
  } catch (error) {
    console.error(`POST /api/download-grants/original/${key} failed`, error);
    return serverError('original_failed');
  }
};
