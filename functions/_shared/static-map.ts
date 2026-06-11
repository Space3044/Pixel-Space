import type { Env } from '../types';
import { readMapboxPublicToken } from './mapbox';
import type { RequestLogger } from './logger';
import type { LocationRegion } from '../../shared/geo-region';
import { wgs84ToGcj02 } from '../../shared/map-coordinate';

const AMAP_STATIC_BASE = 'https://restapi.amap.com/v3/staticmap';
const MAPBOX_STATIC_BASE = 'https://api.mapbox.com/styles/v1';
const MAPBOX_STYLE = 'mapbox/dark-v11';
const DEFAULT_ZOOM = 12;
const SIZE = '600x360';
const AMAP_SIZE = SIZE.replace('x', '*');
const MARKER_COLOR = 'ff4fd8';
const CACHE_CONTROL = 'public, max-age=2592000';

export interface StaticMapLocation {
  lat: number;
  lng: number;
  zoom: number;
  region: LocationRegion;
}

interface StaticMapReference {
  key: string;
  location_lat: number | null;
  location_lng: number | null;
  location_region: LocationRegion | null;
}

type StaticMapProvider = 'amap' | 'mapbox';

type StaticMapLocationParseResult =
  | { location: StaticMapLocation }
  | { error: 'invalid_coordinate' | 'invalid_region' };

export class StaticMapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaticMapError';
  }
}

const parseCoordinate = (value: string | null, min: number, max: number): number | null => {
  if (value === null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
};

const parseRegion = (value: string | null): LocationRegion | null => {
  if (value === 'china' || value === 'global') return value;
  return null;
};

const normalizeLocation = (
  lat: number | null,
  lng: number | null,
  region: LocationRegion | null,
  zoom = DEFAULT_ZOOM,
): StaticMapLocation | null => {
  if (lat === null || lng === null) return null;
  if (!region) return null;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  return { lat, lng, region, zoom: Math.round(zoom) };
};

export const staticMapLocationFromUrl = (url: URL): StaticMapLocationParseResult => {
  const lat = parseCoordinate(url.searchParams.get('lat'), -90, 90);
  const lng = parseCoordinate(url.searchParams.get('lng'), -180, 180);
  const zoom = Math.round(parseCoordinate(url.searchParams.get('zoom'), 3, 18) ?? DEFAULT_ZOOM);
  if (lat === null || lng === null) return { error: 'invalid_coordinate' };

  const region = parseRegion(url.searchParams.get('region'));
  if (!region) return { error: 'invalid_region' };

  const location = normalizeLocation(lat, lng, region, zoom);
  return location ? { location } : { error: 'invalid_coordinate' };
};

const providerForLocation = (location: StaticMapLocation): StaticMapProvider =>
  location.region === 'china' ? 'amap' : 'mapbox';

const readAmapWebKey = (env: Pick<Env, 'AMAP_WEB_KEY'>): string => {
  const key = env.AMAP_WEB_KEY?.trim();
  if (!key) throw new StaticMapError('amap_web_key_missing');
  return key;
};

export const staticMapRefererFromRequest = (request: Request): string => {
  const origin = request.headers.get('origin') ?? new URL(request.url).origin;
  return origin.endsWith('/') ? origin : `${origin}/`;
};

export const staticMapCacheKey = (location: StaticMapLocation): string => {
  const lngStr = location.lng.toFixed(6);
  const latStr = location.lat.toFixed(6);
  return `staticmap/${providerForLocation(location)}_${latStr}_${lngStr}_z${location.zoom}_${SIZE}.png`;
};

const STATIC_MAP_REFERENCE_SQL = (excludedKeys: string): string => `
SELECT key
FROM images
WHERE key NOT IN (${excludedKeys})
  AND location_region = ?
  AND printf('%.6f', location_lat) = ?
  AND printf('%.6f', location_lng) = ?
LIMIT 1
`;

export const deleteUnusedStaticMapCache = async (
  env: Pick<Env, 'DB' | 'BUCKET'>,
  image: StaticMapReference,
  excludedKeys: string[] = [image.key],
): Promise<string | null> => {
  const location = normalizeLocation(image.location_lat, image.location_lng, image.location_region);
  if (!location) return null;

  const uniqueExcludedKeys = Array.from(new Set(excludedKeys.filter(Boolean)));
  if (uniqueExcludedKeys.length === 0) return null;

  const placeholders = uniqueExcludedKeys.map(() => '?').join(',');
  const remainingReference = await env.DB
    .prepare(STATIC_MAP_REFERENCE_SQL(placeholders))
    .bind(...uniqueExcludedKeys, location.region, location.lat.toFixed(6), location.lng.toFixed(6))
    .first<{ key: string }>();
  if (remainingReference) return null;

  const cacheKey = staticMapCacheKey(location);
  await env.BUCKET.delete(cacheKey);
  return cacheKey;
};

export const staticMapObjectResponse = (object: R2ObjectBody): Response => {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', CACHE_CONTROL);
  return new Response(object.body, { headers });
};

export const getCachedStaticMap = (env: Pick<Env, 'BUCKET'>, location: StaticMapLocation): Promise<R2ObjectBody | null> =>
  env.BUCKET.get(staticMapCacheKey(location));

const fetchStaticMap = async (
  requestUrl: string,
  errorPrefix: string,
  logger?: RequestLogger,
  init?: RequestInit,
): Promise<{ bytes: ArrayBuffer; contentType: string }> => {
  let upstream: Response;
  try {
    upstream = await fetch(requestUrl, init);
  } catch {
    throw new StaticMapError(`${errorPrefix}_unreachable`);
  }

  const contentType = upstream.headers.get('content-type') ?? '';
  if (!upstream.ok || !contentType.startsWith('image/')) {
    const detail = await upstream.text().catch(() => '');
    logger?.error(`${errorPrefix} upstream error`, {
      status: upstream.status,
      context: {
        detail: detail.slice(0, 300),
      },
    });
    throw new StaticMapError(`${errorPrefix}_failed`);
  }

  return { bytes: await upstream.arrayBuffer(), contentType };
};

const fetchAmapStaticMap = async (
  env: Pick<Env, 'AMAP_WEB_KEY'>,
  location: StaticMapLocation,
  logger?: RequestLogger,
): Promise<{ bytes: ArrayBuffer; contentType: string }> => {
  const key = readAmapWebKey(env);
  const gcj = wgs84ToGcj02(location.lng, location.lat);
  const lngStr = gcj.lng.toFixed(6);
  const latStr = gcj.lat.toFixed(6);
  const url = new URL(AMAP_STATIC_BASE);
  url.searchParams.set('location', `${lngStr},${latStr}`);
  url.searchParams.set('zoom', String(location.zoom));
  url.searchParams.set('size', AMAP_SIZE);
  url.searchParams.set('markers', `mid,,A:${lngStr},${latStr}`);
  url.searchParams.set('key', key);
  return fetchStaticMap(url.toString(), 'amap_staticmap', logger);
};

const fetchMapboxStaticMap = async (
  env: Pick<Env, 'MAPBOX_PUBLIC_TOKEN'>,
  location: StaticMapLocation,
  logger: RequestLogger | undefined,
  referer: string,
): Promise<{ bytes: ArrayBuffer; contentType: string }> => {
  const tokenResult = readMapboxPublicToken(env);
  if ('error' in tokenResult) throw new StaticMapError(tokenResult.error);

  const lngStr = location.lng.toFixed(6);
  const latStr = location.lat.toFixed(6);
  const marker = `pin-s+${MARKER_COLOR}(${lngStr},${latStr})`;
  const position = `${lngStr},${latStr},${location.zoom}`;
  const requestUrl = `${MAPBOX_STATIC_BASE}/${MAPBOX_STYLE}/static/${marker}/${position}/${SIZE}@2x?access_token=${encodeURIComponent(tokenResult.token)}`;
  return fetchStaticMap(requestUrl, 'mapbox_staticmap', logger, { headers: { referer } });
};

export const generateAndCacheStaticMap = async (
  env: Pick<Env, 'BUCKET' | 'AMAP_WEB_KEY' | 'MAPBOX_PUBLIC_TOKEN'>,
  location: StaticMapLocation,
  logger: RequestLogger | undefined,
  referer: string,
): Promise<Response> => {
  const { bytes, contentType } = location.region === 'china'
    ? await fetchAmapStaticMap(env, location, logger)
    : await fetchMapboxStaticMap(env, location, logger, referer);

  await env.BUCKET.put(staticMapCacheKey(location), bytes, {
    httpMetadata: { contentType, cacheControl: CACHE_CONTROL },
  });

  const headers = new Headers();
  headers.set('content-type', contentType);
  headers.set('cache-control', CACHE_CONTROL);
  return new Response(bytes, { headers });
};

const cacheStaticMap = async (
  env: Pick<Env, 'BUCKET' | 'AMAP_WEB_KEY' | 'MAPBOX_PUBLIC_TOKEN'>,
  location: StaticMapLocation,
  logger: RequestLogger | undefined,
  referer: string,
): Promise<void> => {
  try {
    const cached = await getCachedStaticMap(env, location);
    if (cached) return;
    await generateAndCacheStaticMap(env, location, logger, referer);
  } catch (error) {
    logger?.error('Static map precache failed', {
      error,
      context: {
        lat: location.lat,
        lng: location.lng,
        region: location.region,
        zoom: location.zoom,
      },
    });
  }
};

export const createStaticMapCacheTask = (
  env: Pick<Env, 'BUCKET' | 'AMAP_WEB_KEY' | 'MAPBOX_PUBLIC_TOKEN'>,
  lat: number | null,
  lng: number | null,
  region: LocationRegion | null,
  logger: RequestLogger | undefined,
  referer: string,
): Promise<void> | null => {
  const location = normalizeLocation(lat, lng, region);
  if (!location) return null;
  if (location.region === 'china' && !env.AMAP_WEB_KEY?.trim()) return null;
  if (location.region === 'global' && 'error' in readMapboxPublicToken(env)) return null;
  return cacheStaticMap(env, location, logger, referer);
};
