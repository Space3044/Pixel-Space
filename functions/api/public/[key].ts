import type { Env } from '../../types';
import { notFound, serverError } from '../../_shared/http';

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const key = String(params.key ?? '');
  if (!key) return notFound();

  try {
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
