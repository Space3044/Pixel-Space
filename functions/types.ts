// Pages Functions 运行时环境类型。
// 只声明当前已接入的 binding；Telegram / AI 等未来 binding 后续阶段再加。

export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  PUBLIC_BASE_URL: string;
}
