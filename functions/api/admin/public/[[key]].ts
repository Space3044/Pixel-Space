import type { Env } from '../../../types';
import { resolveAdmin } from '../../../_shared/auth';
import { notFound, serverError, unauthorized } from '../../../_shared/http';
import { keyFromRouteParam } from '../../../_shared/keys';
import { withRequestLogging } from '../../../_shared/logger';

interface ImageObjectRow {
  key: string;
}

export const onRequestGet: PagesFunction<Env> = withRequestLogging('/api/admin/public/:key', async ({ env, params, request }, logger) => {
  if (!(await resolveAdmin(request, env))) return unauthorized();

  const key = keyFromRouteParam(params.key);
  if (!key) return notFound();

  try {
    const row = await env.DB.prepare('SELECT key FROM images WHERE key = ?').bind(key).first<ImageObjectRow>();
    if (!row) return notFound();

    const object = await env.BUCKET.get(key);
    if (!object) return notFound();

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('cache-control', 'public, max-age=31536000, immutable');

    return new Response(object.body, { headers });
  } catch (error) {
    logger.error('GET /api/admin/public/:key failed', {
      error,
      context: { key },
    });
    return serverError('public_object_failed');
  }
});
