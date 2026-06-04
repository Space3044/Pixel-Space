import type { Env } from '../types';
import { badRequest, serverError } from '../_shared/http';

// 只读位置预览的静态地图代理。命中 R2 缓存直接吐图，零图源调用；未命中才调一次
// Mapbox Static Images 并回写 R2。国内外统一用 Mapbox（WGS-84，无需坐标转换），
// 底图风格一致、海外也有详细街道，额度消耗只正比于去重后的位置数量。

const MAPBOX_STATIC_BASE = 'https://api.mapbox.com/styles/v1';
const MAPBOX_STYLE = 'mapbox/dark-v11';
const DEFAULT_ZOOM = 12;
const SIZE = '600x360';
const MARKER_COLOR = 'ff4fd8'; // 粉色定位点，呼应只读地图的 pin 配色
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

  const zoom = Math.round(parseCoordinate(url.searchParams.get('zoom'), 3, 18) ?? DEFAULT_ZOOM);

  const lngStr = lng.toFixed(6);
  const latStr = lat.toFixed(6);
  const cacheKey = `staticmap/mapbox_${latStr}_${lngStr}_z${zoom}_${SIZE}.png`;

  try {
    const cached = await env.BUCKET.get(cacheKey);
    if (cached) {
      const headers = new Headers();
      cached.writeHttpMetadata(headers);
      headers.set('etag', cached.httpEtag);
      headers.set('cache-control', CACHE_CONTROL);
      return new Response(cached.body, { headers });
    }
  } catch (error) {
    console.error('GET /api/staticmap cache read failed', error);
  }

  const token = env.MAPBOX_TOKEN?.trim();
  if (!token) return serverError('mapbox_token_missing');

  // Mapbox 用 WGS-84，存储坐标直接用，经度在前。括号、逗号、加号是 path 语法不能 encode。
  const marker = `pin-s+${MARKER_COLOR}(${lngStr},${latStr})`;
  const position = `${lngStr},${latStr},${zoom}`;
  const requestUrl = `${MAPBOX_STATIC_BASE}/${MAPBOX_STYLE}/static/${marker}/${position}/${SIZE}@2x?access_token=${encodeURIComponent(token)}`;

  let upstream: Response;
  try {
    upstream = await fetch(requestUrl);
  } catch (error) {
    console.error('GET /api/staticmap upstream fetch failed', error);
    return serverError('mapbox_staticmap_unreachable');
  }

  const contentType = upstream.headers.get('content-type') ?? '';
  if (!upstream.ok || !contentType.startsWith('image/')) {
    // Mapbox 出错时返回 JSON 错误体（401 token 无效、422 参数错等）。
    const detail = await upstream.text().catch(() => '');
    console.error('GET /api/staticmap upstream error', upstream.status, detail.slice(0, 300));
    return serverError('mapbox_staticmap_failed');
  }

  const bytes = await upstream.arrayBuffer();

  try {
    await env.BUCKET.put(cacheKey, bytes, {
      httpMetadata: { contentType, cacheControl: CACHE_CONTROL },
    });
  } catch (error) {
    console.error('GET /api/staticmap cache write failed', error);
  }

  const headers = new Headers();
  headers.set('content-type', contentType);
  headers.set('cache-control', CACHE_CONTROL);
  return new Response(bytes, { headers });
};
