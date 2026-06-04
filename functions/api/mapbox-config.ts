import { json, serverError } from '../_shared/http';
import type { Env } from '../types';

// 浏览器端 MapLibre 加载 Mapbox 栅格瓦片需要 access token。
// 用 public token（pk. 开头）即可，暴露给前端是 Mapbox 设计内的用法。
interface MapboxConfigResponse {
  token: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const token = env.MAPBOX_TOKEN?.trim();
  if (!token) return serverError('mapbox_token_missing');

  const payload: MapboxConfigResponse = { token };
  return json(payload);
};
