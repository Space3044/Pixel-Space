import type { Env } from '../types';
import { badRequest, serverError } from '../_shared/http';
import { wgs84ToGcj02 } from '../_shared/gcj02';

// 只读位置预览的静态地图代理。命中 R2 缓存直接吐图，零高德调用；
// 未命中才调一次高德静态地图 API 并回写 R2。这样额度消耗只正比于去重后的
// 位置数量，而非访客访问量，公开图床才扛得住流量。

const AMAP_STATICMAP_URL = 'https://restapi.amap.com/v3/staticmap';
const DEFAULT_ZOOM = 12;
const SIZE = '600*360';
const MARKER_STYLE = 'mid,0xFF4FD8,'; // 粉色定位点，无字母标签，呼应只读地图的 pin 配色
const CACHE_CONTROL = 'public, max-age=2592000';

const parseCoordinate = (value: string | null, min: number, max: number): number | null => {
  if (value === null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const lat = parseCoordinate(url.searchParams.get('lat'), -90, 90);
  const lng = parseCoordinate(url.searchParams.get('lng'), -180, 180);
  if (lat === null || lng === null) return badRequest('invalid_coordinate');

  const zoomRaw = parseCoordinate(url.searchParams.get('zoom'), 3, 18) ?? DEFAULT_ZOOM;
  const zoom = Math.round(zoomRaw);

  const cacheKey = `staticmap/${lat.toFixed(6)}_${lng.toFixed(6)}_z${zoom}_${SIZE.replace('*', 'x')}.png`;

  try {
    const cached = await env.BUCKET.get(cacheKey);
    if (cached) {
      const headers = new Headers();
      cached.writeHttpMetadata(headers);
      headers.set('etag', cached.httpEtag);
      headers.set('content-type', 'image/png');
      headers.set('cache-control', CACHE_CONTROL);
      return new Response(cached.body, { headers });
    }
  } catch (error) {
    console.error('GET /api/staticmap cache read failed', error);
  }

  const key = env.AMAP_WEB_KEY?.trim();
  if (!key) return serverError('amap_web_key_missing');

  // 存储坐标是 WGS84，高德静态地图要 GCJ-02。
  const gcj = wgs84ToGcj02(lng, lat);
  const center = `${gcj.lng.toFixed(6)},${gcj.lat.toFixed(6)}`;
  // 逗号、冒号是 markers/location 的分隔符，不能被 encode，手动拼 query。
  const query = `location=${center}&zoom=${zoom}&size=${SIZE}&markers=${MARKER_STYLE}:${center}&key=${encodeURIComponent(key)}`;

  let upstream: Response;
  try {
    upstream = await fetch(`${AMAP_STATICMAP_URL}?${query}`);
  } catch (error) {
    console.error('GET /api/staticmap upstream fetch failed', error);
    return serverError('amap_staticmap_unreachable');
  }

  const contentType = upstream.headers.get('content-type') ?? '';
  if (!upstream.ok || !contentType.startsWith('image/')) {
    // 高德出错时 HTTP 仍可能 200，但返回的是 JSON 错误体。
    const detail = await upstream.text().catch(() => '');
    console.error('GET /api/staticmap upstream error', upstream.status, detail.slice(0, 300));
    return serverError('amap_staticmap_failed');
  }

  const bytes = await upstream.arrayBuffer();

  try {
    await env.BUCKET.put(cacheKey, bytes, {
      httpMetadata: { contentType: 'image/png', cacheControl: CACHE_CONTROL },
    });
  } catch (error) {
    console.error('GET /api/staticmap cache write failed', error);
  }

  const headers = new Headers();
  headers.set('content-type', 'image/png');
  headers.set('cache-control', CACHE_CONTROL);
  return new Response(bytes, { headers });
};
