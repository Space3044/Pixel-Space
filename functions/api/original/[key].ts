import type { Env } from '../../types';
import { notFound, serverError, unauthorized } from '../../_shared/http';
import { resolveAdmin } from '../../_shared/auth';
import { getTelegramFileUrl } from '../../_shared/telegram';

const ORIGINAL_SQL = 'SELECT key, title, original_filename, tg_file_id FROM images WHERE key = ?';

interface OriginalRow {
  key: string;
  title: string;
  original_filename: string;
  tg_file_id: string | null;
}

function downloadName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'original';
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params, request }) => {
  if (!resolveAdmin(request, env)) return unauthorized();

  const key = String(params.key ?? '');
  if (!key) return notFound();

  try {
    const row = await env.DB.prepare(ORIGINAL_SQL).bind(key).first<OriginalRow>();
    if (!row) return notFound();
    if (!row.tg_file_id) return notFound('original_not_archived');

    const fileUrl = await getTelegramFileUrl(env.TG_BOT_TOKEN, row.tg_file_id);
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) throw new Error(`telegram_download_failed:${fileResponse.status}`);

    const headers = new Headers();
    headers.set('content-type', fileResponse.headers.get('content-type') ?? 'application/octet-stream');
    headers.set('content-disposition', `attachment; filename="${downloadName(row.original_filename || key)}"`);
    headers.set('cache-control', 'no-store');

    return new Response(fileResponse.body, { headers });
  } catch (error) {
    console.error(`GET /api/original/${key} failed`, error);
    return serverError('original_failed');
  }
};
