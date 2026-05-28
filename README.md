# Pixel Space (imgbed)

个人自用图床。压缩图保存到 Cloudflare R2，原图通过 Telegram Bot 归档到私有频道。前端走 Vue 3 SPA，边缘 API 走 Cloudflare Pages Functions，数据库用 Cloudflare D1，整套部署在 Cloudflare Pages 上。

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | Vue 3.5（`<script setup>` + Composition API）+ Vite 6 + TypeScript + TailwindCSS + vue-router 4 |
| 边缘 | Cloudflare Pages Functions（文件路由）|
| 数据 | D1（SQLite）+ R2（压缩 WebP）+ Telegram 私有频道（原图归档）|
| 工具库 | 高德 JS API 2.0（平面地图）、three（旋转地球）、justified-layout（瀑布）、browser-image-compression、exifr |
| 测试 | tsx + Node 原生 test runner（`tests/*.test.mjs`）|

## 目录结构

```
src/                          Vue 前端 SPA
  app/        App.vue / main.ts / router.ts（路由守卫 + 标题）
  features/   按页面分模块，每个模块自带 *.vue + *.api.ts + *.types.ts
    home/         /            着陆页
    images/       /images      探索（瀑布 + 搜索 + 文件夹筛选 + lightbox）
    images/       /p/:key      公开分享页
    random/       /random      随机一张
    hive/         /hive        旅行足迹（高德平面图 + Three.js 旋转地球）
    upload/       /upload      多文件上传 + EXIF + AI 预览 + 批量目录
    library/      /library     管理员控制台（文件管理 + AI 配置）
    auth/         /login       Cloudflare Access 引导
  shared/     auth/useAdmin.ts + ui/AppShell|SelectPopover
  styles/     全局 token

functions/                    Cloudflare Workers (Pages Functions)
  types.ts                   Env binding 类型（DB/BUCKET/TG_*/AMAP_JS_KEY/…）
  _shared/                   auth / http / images / folders / ai / telegram 公共模块
  api/                       文件路由 = URL
    list.ts                 GET /api/list             分页 + 搜索
    upload.ts               POST /api/upload          R2 + Telegram 归档 + AI 标注
    check-hash.ts           GET 去重
    image/[key].ts          GET 公开详情
    public/[key].ts         GET R2 回吐压缩图
    original/[key].ts       GET 走 Telegram getFile 取原图
    admin/
      me.ts                 身份探测
      image/[key].ts        PATCH / DELETE 单图
      images/{move,delete}  批量操作
      folders/              目录 CRUD
      ai-settings.ts        AI 代理配置
    ai/preview.ts           代理一次 AI 推理
    amap-config.ts          高德 JS API 浏览器配置
    geocode.ts              国外位置搜索代理

db/migrations/                D1 初始化迁移
docs/PLAN.md                  阶段交付计划
tests/                        API 形状 / 文件结构 / 迁移 / UI 标记
```

## 关键设计

### 鉴权信号靠 hostname

[`functions/_shared/auth.ts`](functions/_shared/auth.ts) 把生产鉴权和本地开发严格隔离：

- 线上：hostname 不在 `localhost / 127.0.0.1 / 0.0.0.0` 时，只信 `Cf-Access-Authenticated-User-Email`（Cloudflare Access 注入的邮箱头），env 和请求头里的角色一律忽略。
- 本地：`X-Dev-Role`（header）> `LOCAL_ROLE`（env）> 默认 admin。前端的开发者角色切换通过 header 注入，线上无效。

不用 `request.cf` 作信号，是因为 `wrangler pages dev` 会模拟 cf 对象，hostname 更稳。

### 存储三层分离

- **压缩 WebP → R2**：访问统一走 `PUBLIC_BASE_URL`（本地默认 `/api/public` 通过 Function 回吐，线上可换 R2 公开域）。
- **原图 → Telegram 私有频道**：D1 只保存 `tg_file_id / tg_chat_id / tg_message_id` 凭据，原图下载走受 Cloudflare Access 保护的 `/api/original/:key`，由 Function 调 Telegram getFile 拉回。
- **元数据 → D1**：34 列覆盖 EXIF / 位置 / AI 标注 / 可见性 / 文件夹归属 / Telegram 索引。

原图是单副本归档：频道、Bot、Telegram 文件不可用时原图下载会不可用，公开页面只展示压缩图，不暴露原图入口。

### 可见性双轨

[`0001_init.sql`](db/migrations/0001_init.sql)：

- `is_public`：是否进入聚合视图（列表 / 搜索 / 随机 / 足迹）。私藏图片仍可凭 key 直链访问，但不会被列出。
- `location_public`：访客是否能拿到 `location_lat / location_lng / location_name`。详情页地图仍渲染但无标记。

文件库里两个虚拟智能目录「未公开图片 / 未公开位置」直接消费这两个字段做筛选。

### AI 标注链路

上传时 Function 调用 AI 代理（OpenAI 兼容端点），一次推理拿回 `tags / search_content / dominant_color / color_palette / composition` 五个字段。其中 `search_content` 用于 `/api/list` 的 `LIKE` 多字段搜索。代理 URL、模型名和系统提示词存在 `ai_settings` 表里，运行时可由管理员修改；`PROXY_KEY` 通过环境变量注入，不入库。

## 数据模型

- `images`（34 列，主表）：核心元数据 + EXIF + 位置 + Telegram 凭据 + AI 标注 + 可见性 + `folder_id`
- `folders`（5 列）：`id / parent_id / name`，`UNIQUE(COALESCE(parent_id,''), name)` 防同级重名，自引用 FK
- `ai_settings`（5 列，单行 `id = 1`）：代理 URL + 模型名 + 系统提示词

完整字段清单见单一初始化迁移 [`0001_init.sql`](db/migrations/0001_init.sql)。

## 开发与部署

### 前置准备

```bash
pnpm install
wrangler login
wrangler d1 create imgbed          # 把返回的 database_id 写进 wrangler.toml
wrangler r2 bucket create imgbed
pnpm db:migrate:local              # 应用本地迁移
```

### 常用命令

```bash
pnpm dev                  # 纯前端开发，API 由 mock 或代理处理
pnpm dev:pages            # Wrangler Pages 本地全栈：前端 + Functions + D1 + R2
pnpm typecheck            # 三套 tsconfig 都跑（app / node / functions）
pnpm test                 # 跑 tests/*.test.mjs
pnpm build                # typecheck + vite build → dist/
pnpm db:migrate:local     # 应用本地迁移
pnpm db:migrate:remote    # 应用线上迁移
```

### TypeScript 分包

- `tsconfig.app.json`：Vue + DOM
- `tsconfig.node.json`：Vite 配置、构建脚本
- `tsconfig.functions.json`：Cloudflare Workers 运行时

三套独立 lib/types，互不污染，`pnpm typecheck` 串行跑过才允许 build。

## 本地 Telegram 配置

不要把真实 token 写进代码或提交到仓库。本地开发在 `.dev.vars` 写：

```env
TG_BOT_TOKEN=
TG_CHAT_ID=
```

线上环境用 Cloudflare Pages 的环境变量或 `wrangler secret` 配置同名变量。

## 本地高德地图配置

高德地图和国内位置搜索共用浏览器 JS API 配置。本地开发在 `.dev.vars` 写：

```env
AMAP_JS_KEY=
AMAP_SECURITY_JS_CODE=
```

`AMAP_JS_KEY` 用高德控制台里的「Web端（JS API）」Key，配套 `AMAP_SECURITY_JS_CODE`。国内位置搜索走浏览器里的高德 JS API，国外位置搜索再走 `/api/geocode`。

## 上传与归档约束

- 单张原图上限 50MB，对齐 Telegram Bot API 单文件限制。
- 浏览器端用 [browser-image-compression](https://github.com/Donaldcwl/browser-image-compression) 把图压成 WebP 上传 R2；EXIF 用 [exifr](https://github.com/MikeKovarik/exifr) 在前端解析后随表单一起提交。
- 原图保存在 Telegram 私有频道这一份，属于单副本归档。
