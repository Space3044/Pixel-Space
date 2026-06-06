import type { Env } from '../../types';
import { notFound, serverError } from '../../_shared/http';
import { keyFromRouteParam } from '../../_shared/keys';
import { resolveAdmin } from '../../_shared/auth';

interface VisibilityRow {
  is_public: number;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params, request }) => {
  const key = keyFromRouteParam(params.key);
  if (!key) return notFound();

  try {
    const row = await env.DB.prepare('SELECT is_public FROM images WHERE key = ?').bind(key).first<VisibilityRow>();
    if (!row) return notFound();

    const isAdmin = (await resolveAdmin(request, env)) !== null;
    if (!isAdmin && row.is_public !== 1) return notFound();

    const object = await env.BUCKET.get(key);
    if (!object) return notFound();

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('cache-control', 'public, max-age=31536000, immutable');

    return new Response(object.body, { headers });
  } catch (error) {
    console.error(`GET /api/public/${key} failed`, error);
    return serverError('public_object_failed');
  }
};
