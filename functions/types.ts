// Pages Functions 运行时环境类型。
// 只声明当前已接入的 binding；AI 等未来 binding 后续阶段再加。

export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  PUBLIC_BASE_URL: string;
  TG_BOT_TOKEN: string;
  TG_CHAT_ID: string;
}
