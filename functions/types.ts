// Pages Functions 运行时环境类型。
// 阶段 4 只包含本阶段会用到的 binding；后续阶段 ADD COLUMN 一样的方式按需扩展，
// 不提前声明 R2 / Telegram / AI 等未来 binding。

export interface Env {
  DB: D1Database;
  PUBLIC_BASE_URL: string;
}
