import { getTelegramFileUrl } from './telegram';

export interface OriginalImageRow {
  key: string;
  original_filename: string;
  tg_file_id: string | null;
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
