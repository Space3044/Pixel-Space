import type { Env } from '../../types';
import { resolveAdmin } from '../../_shared/auth';
import { badRequest, serverError, unauthorized } from '../../_shared/http';
import { withRequestLogging } from '../../_shared/logger';
import {
  generateAndCacheStaticMap,
  getCachedStaticMap,
  StaticMapError,
  staticMapLocationFromUrl,
  staticMapObjectResponse,
} from '../../_shared/static-map';

export const onRequestGet: PagesFunction<Env> = withRequestLogging('/api/admin/staticmap', async ({ request, env }, logger) => {
  if (!(await resolveAdmin(request, env))) return unauthorized();

  const parsed = staticMapLocationFromUrl(new URL(request.url));
  if ('error' in parsed) return badRequest(parsed.error);
  const { location } = parsed;

  try {
    const cached = await getCachedStaticMap(env, location);
    if (cached) return staticMapObjectResponse(cached);
  } catch (error) {
    logger.error('GET /api/admin/staticmap cache read failed', {
      error,
      context: { location },
    });
    return serverError('staticmap_cache_failed');
  }

  try {
    return await generateAndCacheStaticMap(env, location, logger);
  } catch (error) {
    logger.error('GET /api/admin/staticmap generation failed', {
      error,
      context: { location },
    });
    if (error instanceof StaticMapError) return serverError(error.message);
    return serverError('mapbox_staticmap_failed');
  }
});
