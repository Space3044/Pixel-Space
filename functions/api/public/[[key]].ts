import type { Env } from '../../types';
import { notFound, serverError } from '../../_shared/http';
import { keyFromRouteParam } from '../../_shared/keys';
import { withRequestLogging } from '../../_shared/logger';

interface VisibilityRow {
  is_public: number;
}

const PUBLIC_OBJECT_CACHE_CONTROL = 'public, max-age=31536000, immutable';

const edgeCache = (): Cache | null => (typeof caches === 'undefined' ? null : caches.default);

export const onRequestGet: PagesFunction<Env> = withRequestLogging('/api/public/:key', async (context, logger) => {
  const { env, params, request } = context;
  const key = keyFromRouteParam(params.key);
  if (!key) return notFound();

  try {
    const row = await env.DB.prepare('SELECT is_public FROM images WHERE key = ?').bind(key).first<VisibilityRow>();
    if (!row) return notFound();

    if (row.is_public !== 1) return notFound();

    const cache = edgeCache();
    const cacheKey = new Request(request.url, { method: 'GET' });
    const cached = cache ? await cache.match(cacheKey) : undefined;
    if (cached) return cached;

    const object = await env.BUCKET.get(key);
    if (!object) return notFound();

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('cache-control', PUBLIC_OBJECT_CACHE_CONTROL);

    const response = new Response(object.body, { headers });
    if (cache) {
      const cacheWrite = cache.put(cacheKey, response.clone()).catch((error) => {
        logger.warn('Public object cache write failed', {
          error,
          context: { key },
        });
      });
      if (typeof context.waitUntil === 'function') {
        context.waitUntil(cacheWrite);
      } else {
        await cacheWrite;
      }
    }

    return response;
  } catch (error) {
    logger.error('GET /api/public/:key failed', {
      error,
      context: { key },
    });
    return serverError('public_object_failed');
  }
});
