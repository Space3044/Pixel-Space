# imgbed

个人自用图床。压缩图保存到 R2，原图通过 Telegram Bot 归档到私有频道。

## 本地 Telegram 配置

不要把真实 token 写进代码或提交到仓库。本地开发可在 `.dev.vars` 写：

```env
TG_BOT_TOKEN=
TG_CHAT_ID=
```

线上环境用 Cloudflare Pages 的环境变量或 `wrangler secret` 配置同名变量。

## 原图归档限制

当前上传单张原图上限是 50MB，和 Telegram Bot API 的单文件限制保持一致。原图只保存 Telegram 私有频道这一份，属于单副本归档；频道、Bot、Telegram 文件不可用时，原图下载也会不可用。

公开页面只展示 R2 里的 WebP 压缩图，不暴露原图入口。管理员下载原图走受 Cloudflare Access 保护的 `/api/original/:key`。
