// Pages Functions 运行时环境类型。
// 只声明当前已接入的 binding。

export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  PUBLIC_BASE_URL: string;
  TG_BOT_TOKEN: string;
  TG_CHAT_ID: string;
  PROXY_KEY: string;
  AMAP_KEY?: string;
  MAPTILER_KEY?: string;
  // 仅本地开发可用。线上 (request.cf 存在) 时被强制忽略，绝不参与生产鉴权。
  // 取值: 'admin' | 'visitor'，缺省视为 'admin'。
  LOCAL_ROLE?: string;
}
