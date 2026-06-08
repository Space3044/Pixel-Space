export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  PUBLIC_BASE_URL: string;
  TG_BOT_TOKEN: string;
  TG_CHAT_ID: string;
  PROXY_KEY: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  AMAP_JS_KEY?: string;
  AMAP_SECURITY_JS_CODE?: string;
  // 高德 Web 服务 API key，只在服务端生成国内静态地图时使用。
  AMAP_WEB_KEY?: string;
  // Mapbox public access token，用于海外底图和海外静态地图。
  MAPBOX_PUBLIC_TOKEN?: string;
  MAPTILER_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  VITE_TURNSTILE_SITE_KEY?: string;
  // 仅本地开发可用。线上 (request.cf 存在) 时被强制忽略，绝不参与生产鉴权。
  // 取值: 'admin' | 'visitor'，缺省视为 'admin'。
  LOCAL_ROLE?: string;
}
