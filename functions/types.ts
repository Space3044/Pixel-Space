export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  PUBLIC_BASE_URL: string;
  TG_BOT_TOKEN: string;
  TG_CHAT_ID: string;
  PROXY_KEY: string;
  AMAP_JS_KEY?: string;
  AMAP_SECURITY_JS_CODE?: string;
  // 高德 Web 服务 API key，静态地图代理用，与 JS API key 不同源，需单独申请。
  AMAP_WEB_KEY?: string;
  // Mapbox access token，静态地图与足迹页底图统一用它。
  MAPBOX_TOKEN?: string;
  MAPTILER_KEY?: string;
  // 仅本地开发可用。线上 (request.cf 存在) 时被强制忽略，绝不参与生产鉴权。
  // 取值: 'admin' | 'visitor'，缺省视为 'admin'。
  LOCAL_ROLE?: string;
}
