# Pixel Space

个人自用图床和旅行相册。上传时在浏览器侧压缩图片、提取 EXIF、补充位置与 AI 标注；边缘 API 把压缩图写入 Cloudflare R2，把原图归档到 Telegram 私有频道，把元数据写入 Cloudflare D1。访客看到公开图片，管理员可以管理目录、可见性、AI 配置和原图通行码。

## 功能概览

- 图片上传：多图队列、SHA-256 去重、WebP 压缩、EXIF 读取、位置搜索、地图选点、批量目录、上传进度。
- 图片浏览：瀑布流探索、搜索、排序、lightbox、公开分享页、随机图片页。
- 隐私控制：图片公开状态和位置公开状态分开控制。私有图片不进公开列表，私密位置会在访客响应里被擦除。
- 原图归档：压缩图放 R2，原图通过 Telegram Bot 发送到私有频道，D1 只保存 Telegram 文件凭据。
- 原图通行：管理员可给一组图片生成限时验证码，访客在 `/access` 输入验证码后下载对应原图。
- 地图足迹：国内足迹用高德地图，海外足迹用 Mapbox / MapLibre，位置详情静态图走 Mapbox Static Images 并缓存到 R2。
- AI 标注：管理员配置 OpenAI 兼容代理后，上传页可生成标题、描述、标签、搜索内容、主色、色板和构图信息。

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | Vue 3.5、Vite 6、TypeScript、TailwindCSS、vue-router 4 |
| 地图 | 高德 JS API、MapLibre GL、Mapbox Static Images、Three.js |
| 边缘 API | Cloudflare Pages Functions 文件路由 |
| 数据 | Cloudflare D1、Cloudflare R2、Telegram Bot API |
| 图像处理 | browser-image-compression、exifr、justified-layout |
| 测试 | Node 原生 test runner、tsx |

## 目录结构

```text
src/
  app/                    Vue 入口、路由、应用壳
  features/
    home/                 首页
    images/               探索页、公开详情、图片 API、lightbox、只读地图
    random/               随机图片页
    footprints/           国内 / 世界足迹地图和边界地球
    upload/               上传工作台、EXIF、压缩、AI 预览、地图选点
    library/              /library      管理员控制台（文件管理 + AI 配置）
    auth/                 Cloudflare Access 登录引导
    access/               访客原图通行页
  shared/                 共享 API、鉴权状态、通用 UI
  styles/                 全局样式和视觉 token

functions/
  api/                    Pages Functions API，文件路径即 URL
  _shared/                auth、http、images、folders、telegram、ai 等公共模块
  types.ts                Cloudflare Env binding 类型

db/migrations/            D1 迁移
tests/                    API、迁移、文件结构和 UI 行为测试
public/maps/              本地地图边界数据
```

## 路由

| 路径 | 说明 |
|---|---|
| `/` | 首页 |
| `/images` | 公开探索页 |
| `/p/:key` | 单图公开页 |
| `/random` | 随机图片，从公开列表里抽取 |
| `/footprints` | 旅行足迹 |
| `/access` | 通行码下载原图 |
| `/upload` | 管理员上传页 |
| `/library` | 管理员控制台 |
| `/login` | Access 登录引导 |

`/upload` 和 `/library` 需要管理员身份。生产环境的管理员身份只信 Cloudflare Access 注入的 `Cf-Access-Authenticated-User-Email` 请求头。

## API 摘要

| API | 方法 | 权限 | 用途 |
|---|---|---|---|
| `/api/list` | GET | 访客 / 管理员 | 图片列表、搜索、目录筛选、可选游标分页 |
| `/api/image/:key` | GET | 访客 / 管理员 | 单图详情 |
| `/api/public/:key` | GET | 公开 | 从 R2 回吐压缩图 |
| `/api/stats` | GET | 公开 | 首页统计 |
| `/api/folders` | GET | 公开 | 公开文件夹列表 |
| `/api/upload` | POST | 管理员 | 上传压缩图和元数据，后台归档原图 |
| `/api/check-hash` | GET | 管理员 | 上传前去重 |
| `/api/original/:key` | GET | 管理员 | 管理员下载原图 |
| `/api/admin/me` | GET | 管理员 | 当前管理员身份探测 |
| `/api/admin/image/:key` | PATCH / DELETE | 管理员 | 更新或删除单图 |
| `/api/admin/images/move` | POST | 管理员 | 批量移动图片 |
| `/api/admin/images/delete` | POST | 管理员 | 批量删除图片 |
| `/api/admin/folders` | POST | 管理员 | 新建目录 |
| `/api/admin/folders/:id` | PATCH / DELETE | 管理员 | 重命名或删除目录 |
| `/api/admin/ai-settings` | GET / PATCH | 管理员 | AI 代理配置 |
| `/api/ai/preview` | POST | 管理员 | 单次图片 AI 预览 |
| `/api/admin/download-grants` | GET / POST | 管理员 | 通行码列表和创建 |
| `/api/admin/download-grants/:id` | PATCH / DELETE | 管理员 | 更新或删除通行码 |
| `/api/download-grants/verify` | POST | 公开 | 校验通行码并返回授权图片 |
| `/api/download-grants/original/:key` | POST | 公开 | 用通行码下载原图 |
| `/api/amap-config` | GET | 公开 | 前端高德 JS API 配置 |
| `/api/mapbox-config` | GET | 公开 | 前端 Mapbox token 配置 |
| `/api/geocode` | GET | 公开 | 海外位置搜索代理 |
| `/api/staticmap` | GET | 公开 | Mapbox 静态地图代理和 R2 缓存 |

## 核心流程

### 上传与归档

1. 浏览器读取原图，计算 SHA-256，先调用 `/api/check-hash` 做去重。
2. 浏览器用 `browser-image-compression` 压缩成 WebP，最长边限制为 2048。
3. 浏览器用 `exifr` 解析 EXIF，并可通过地图搜索或选点补充位置。
4. 如已配置 AI 代理，上传页可先调用 `/api/ai/preview` 生成标题、描述、标签和搜索字段。
5. `/api/upload` 校验表单，把压缩图写入 R2，把元数据写入 D1。
6. 原图通过 Telegram Bot 归档到私有频道，归档结果写回 `tg_status`。

R2 对象按用途分前缀：压缩图写入 `images/<uuid>`，静态地图缓存写入 `staticmap/mapbox_<lat>_<lng>_z<zoom>_600x360.png`。公开图片地址默认走 `/api/public/images/<uuid>`，由 Pages Function 从 R2 回吐。

单张原图上限是 50MB，对齐 Telegram Bot API 的文件限制。原图只有 Telegram 这一份归档，Telegram 凭据失效时原图下载会不可用，但公开压缩图仍可从 R2 访问。

### 权限模型

鉴权逻辑在 [`functions/_shared/auth.ts`](functions/_shared/auth.ts)。

- 生产环境：hostname 不是 `localhost`、`127.0.0.1` 或 `0.0.0.0` 时，只接受 Cloudflare Access 注入的邮箱头。
- 本地开发：`X-Dev-Role` 请求头优先，其次是 `LOCAL_ROLE`，缺省为管理员。

不要用本地角色变量模拟生产权限。生产访问控制应由 Cloudflare Access 负责。

### 可见性模型

`images` 表里有两条独立开关：

- `is_public` 控制图片是否进入公开列表、搜索、随机和足迹。
- `location_public` 控制访客是否能看到地名和经纬度。

管理员始终看到完整记录。访客请求会经过 `scrubRecordForVisitor`，当 `location_public = 0` 时清空位置字段。

### 原图通行码

管理员在 `/library` 选择图片后可以生成限时验证码。验证码记录在 `download_grants`，授权图片关系记录在 `download_grant_images`。访客进入 `/access` 输入验证码后，只能下载该验证码覆盖的图片原图。

### 地图与地理编码

- 国内搜索和选点走高德 JS API。
- 海外搜索优先 MapTiler，缺省回退到 Nominatim 和 Photon。
- 足迹页按 `location_region` 分国内和海外点位。
- 静态位置预览统一走 `/api/staticmap`，未命中缓存时请求 Mapbox Static Images，并把结果写入 R2。

## 数据模型

迁移文件在 [`db/migrations`](db/migrations)。

| 表 | 用途 |
|---|---|
| `images` | 图片主表，保存元数据、EXIF、位置、Telegram 凭据、AI 标注、可见性和目录 |
| `folders` | 树形目录，使用同级唯一名称约束 |
| `ai_settings` | 单行 AI 代理配置，`PROXY_KEY` 不入库 |
| `download_grants` | 原图通行码、哈希和过期时间 |
| `download_grant_images` | 通行码和图片的多对多关系 |

## 本地开发

### 安装依赖

```bash
pnpm install
```

### 准备 Cloudflare 资源

```bash
wrangler login
wrangler d1 create imgbed
wrangler r2 bucket create imgbed
pnpm db:migrate:local
```

把 `wrangler d1 create` 返回的 `database_id` 写入 [`wrangler.toml`](wrangler.toml)。本地开发可以使用任意非空 ID，部署前需要换成真实 D1 database id。

### 配置本地环境变量

本地 secrets 放在 `.dev.vars`。不要把真实 token 写进代码或提交到仓库。

```env
TG_BOT_TOKEN=
TG_CHAT_ID=
PROXY_KEY=
AMAP_JS_KEY=
AMAP_SECURITY_JS_CODE=
AMAP_WEB_KEY=
MAPBOX_TOKEN=
MAPTILER_KEY=
LOCAL_ROLE=admin
```

变量说明：

| 变量 | 必需 | 用途 |
|---|---|---|
| `TG_BOT_TOKEN` | 是 | Telegram Bot token，用于原图归档和下载 |
| `TG_CHAT_ID` | 是 | Telegram 私有频道或群组 ID |
| `PROXY_KEY` | AI 可选 | OpenAI 兼容代理鉴权 |
| `AMAP_JS_KEY` | 地图可选 | 高德 JS API Key |
| `AMAP_SECURITY_JS_CODE` | 地图可选 | 高德 JS API 安全密钥 |
| `AMAP_WEB_KEY` | 预留可选 | 高德 Web 服务 Key，当前代码只保留 binding |
| `MAPBOX_TOKEN` | 地图可选 | Mapbox 底图和静态图 token |
| `MAPTILER_KEY` | 地理编码可选 | 海外位置搜索优先 provider |
| `LOCAL_ROLE` | 本地可选 | `admin` 或 `visitor`，只在本地 hostname 生效 |

`PUBLIC_BASE_URL` 已在 [`wrangler.toml`](wrangler.toml) 里默认配置为 `/api/public`。生产环境如果有 R2 公开域名，可以在 Cloudflare Pages 环境变量里覆盖它。

### 启动

```bash
pnpm dev
```

只启动 Vite 前端。

```bash
pnpm dev:pages
```

启动 Cloudflare Pages 本地全栈环境，包含前端、Functions、D1 和 R2。需要联调上传、API、鉴权或地图配置时用这个命令。

## 常用命令

```bash
pnpm typecheck          # Vue / Node / Functions 三套 tsconfig
pnpm test               # 运行 tests/*.test.mjs
pnpm build              # typecheck 后构建 dist/
pnpm preview            # 预览构建产物
pnpm db:migrate:local   # 应用本地 D1 迁移
pnpm db:migrate:remote  # 应用远程 D1 迁移
```

TypeScript 分为三套配置，避免 DOM、Node 和 Workers 类型互相污染：

- `tsconfig.app.json`：Vue 应用和浏览器类型。
- `tsconfig.node.json`：Vite 配置和 Node 侧脚本。
- `tsconfig.functions.json`：Cloudflare Workers 运行时类型。

## 部署

项目按 Cloudflare Pages 部署：

1. 在 Cloudflare 创建 D1 数据库和 R2 bucket。
2. 把真实 D1 `database_id` 写入 [`wrangler.toml`](wrangler.toml)。
3. 在 Cloudflare Pages 配置环境变量和 secrets。
4. 配置 Cloudflare Access，让管理员页面和管理 API 请求带上 Access 邮箱头。
5. 执行远程迁移。
6. 构建并部署 Pages。

```bash
pnpm db:migrate:remote
pnpm build
```

`wrangler.toml` 里的 `pages_build_output_dir` 是 `dist`。

## 维护约束

- 原图是 Telegram 单副本归档，删除 Telegram 消息或更换 Bot 后，已有原图可能无法下载。
- 批量删除图片会同时清理 D1 记录、R2 压缩图和 Telegram 归档消息。
- 访客接口不能返回 `location_public = 0` 的位置字段。
- AI 代理配置存在 D1，代理密钥只通过 `PROXY_KEY` 注入。
- 新增图片字段时，需要同步前端类型、Functions 类型、迁移、`IMAGE_SELECT_COLUMNS` 和相关测试。
