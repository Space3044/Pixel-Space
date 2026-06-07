import { json, serverError } from '../_shared/http';
import { withRequestLogging } from '../_shared/logger';
import { readMapboxPublicToken } from '../_shared/mapbox';
import type { Env } from '../types';

// 浏览器端 MapLibre 加载 Mapbox 栅格瓦片需要 access token。
// 用 public token（pk. 开头）即可，暴露给前端是 Mapbox 设计内的用法。
interface MapboxConfigResponse {
  token: string;
}

export const onRequestGet: PagesFunction<Env> = withRequestLogging('/api/mapbox-config', async ({ env }) => {
  const tokenResult = readMapboxPublicToken(env);
  if ('error' in tokenResult) return serverError(tokenResult.error);

  const payload: MapboxConfigResponse = { token: tokenResult.token };
  return json(payload);
});
