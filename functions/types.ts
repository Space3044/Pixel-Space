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
}
