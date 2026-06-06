import type { Env } from '../../types';
import { resolveAdmin } from '../../_shared/auth';
import { badRequest, serverError, unauthorized } from '../../_shared/http';
import {
  generateAndCacheStaticMap,
  getCachedStaticMap,
  StaticMapError,
  staticMapLocationFromUrl,
  staticMapObjectResponse,
} from '../../_shared/static-map';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await resolveAdmin(request, env))) return unauthorized();

  const parsed = staticMapLocationFromUrl(new URL(request.url));
  if ('error' in parsed) return badRequest(parsed.error);
  const { location } = parsed;

  try {
    const cached = await getCachedStaticMap(env, location);
    if (cached) return staticMapObjectResponse(cached);
  } catch (error) {
    console.error('GET /api/admin/staticmap cache read failed', error);
    return serverError('staticmap_cache_failed');
  }

  try {
    return await generateAndCacheStaticMap(env, location);
  } catch (error) {
    console.error('GET /api/admin/staticmap generation failed', error instanceof Error ? error.message : error);
    if (error instanceof StaticMapError) return serverError(error.message);
    return serverError('mapbox_staticmap_failed');
  }
};
