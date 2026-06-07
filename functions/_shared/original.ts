import type { Env } from '../types';
import { keyFromRouteParam } from './keys';
import { notFound, serverError, unauthorized } from './http';
import { resolveAdmin } from './auth';
import type { RequestLogger } from './logger';
import { getTelegramFileUrl } from './telegram';

export interface OriginalImageRow {
  key: string;
  original_filename: string;
  tg_file_id: string | null;
}

const ORIGINAL_SQL = 'SELECT key, title, original_filename, tg_file_id FROM images WHERE key = ?';

interface OriginalRow extends OriginalImageRow {
  title: string;
}

export function downloadName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'original';
}

export async function streamTelegramOriginal(token: string, row: OriginalImageRow): Promise<Response | null> {
  if (!row.tg_file_id) return null;

  const fileUrl = await getTelegramFileUrl(token, row.tg_file_id);
  const fileResponse = await fetch(fileUrl);
  if (!fileResponse.ok) throw new Error(`telegram_download_failed:${fileResponse.status}`);

  const headers = new Headers();
  headers.set('content-type', fileResponse.headers.get('content-type') ?? 'application/octet-stream');
  headers.set('content-disposition', `attachment; filename="${downloadName(row.original_filename || row.key)}"`);
  headers.set('cache-control', 'no-store');

  return new Response(fileResponse.body, { headers });
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
    logger.error('GET /api/admin/original/:key failed', {
      error,
      context: { key },
    });
    return serverError('original_failed');
  }
};
