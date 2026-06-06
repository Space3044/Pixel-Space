import type { Env } from '../types';
import { badRequest, notFound, serverError } from '../_shared/http';
import {
  getCachedStaticMap,
  type StaticMapLocation,
  staticMapLocationFromUrl,
  staticMapObjectResponse,
} from '../_shared/static-map';

// 公开访问只读取已生成的 R2 静态图。管理员生成走 /api/admin/staticmap。

const PUBLIC_LOCATION_SQL = `
SELECT key
FROM images
WHERE is_public = 1
  AND location_public = 1
  AND location_region = ?
  AND printf('%.6f', location_lat) = ?
  AND printf('%.6f', location_lng) = ?
LIMIT 1
`;

const hasPublicLocation = async (db: D1Database, location: StaticMapLocation): Promise<boolean> => {
  const row = await db
    .prepare(PUBLIC_LOCATION_SQL)
    .bind(location.region, location.lat.toFixed(6), location.lng.toFixed(6))
    .first<{ key: string }>();
  return row !== null;
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const parsed = staticMapLocationFromUrl(new URL(request.url));
  if ('error' in parsed) return badRequest(parsed.error);
  const { location } = parsed;

  try {
    if (!(await hasPublicLocation(env.DB, location))) return notFound();
  } catch (error) {
    console.error('GET /api/staticmap visibility check failed', error);
    return serverError('staticmap_visibility_failed');
  }

  try {
    const cached = await getCachedStaticMap(env, location);
    if (cached) return staticMapObjectResponse(cached);
  } catch (error) {
    console.error('GET /api/staticmap cache read failed', error);
    return serverError('staticmap_cache_failed');
  }

  return notFound();
};
