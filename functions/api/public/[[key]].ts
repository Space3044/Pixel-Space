import type { Env } from '../../types';
import { notFound, serverError } from '../../_shared/http';
import { keyFromRouteParam } from '../../_shared/keys';
import { withRequestLogging } from '../../_shared/logger';

interface VisibilityRow {
  is_public: number;
}

export const onRequestGet: PagesFunction<Env> = withRequestLogging('/api/public/:key', async ({ env, params }, logger) => {
  const key = keyFromRouteParam(params.key);
  if (!key) return notFound();

  try {
    const row = await env.DB.prepare('SELECT is_public FROM images WHERE key = ?').bind(key).first<VisibilityRow>();
    if (!row) return notFound();

    if (row.is_public !== 1) return notFound();

    const object = await env.BUCKET.get(key);
    if (!object) return notFound();

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('cache-control', 'public, max-age=31536000, immutable');

    return new Response(object.body, { headers });
  } catch (error) {
    logger.error('GET /api/public/:key failed', {
      error,
      context: { key },
    });
    return serverError('public_object_failed');
  }
});
