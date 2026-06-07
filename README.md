# Pixel Space

个人自用图床和旅行相册。上传时在浏览器侧压缩图片、提取 EXIF、补充位置与 AI 标注；边缘 API 把压缩图写入 Cloudflare R2，把原图归档到 Telegram 私有频道，把元数据写入 Cloudflare D1。访客看到公开图片，管理员可以管理目录、可见性、AI 配置和原图通行码。

## 功能概览

- 图片上传：多图队列、SHA-256 去重、WebP 压缩、EXIF 读取、位置搜索、地图选点、批量目录、上传进度。
- 图片浏览：瀑布流探索、搜索、排序、lightbox、公开分享页、随机图片页。
- 隐私控制：图片公开状态和位置公开状态分开控制。私有图片不进公开列表，私密位置会在访客响应里被擦除。
- 原图归档：压缩图放 R2，原图通过 Telegram Bot 发送到私有频道，D1 只保存 Telegram 文件凭据。
- 原图通行：管理员可给一组图片生成限时验证码，访客在 `/access` 输入验证码后下载对应原图。
- 地图足迹：国内足迹用高德地图，海外足迹用 Mapbox / MapLibre，位置详情静态图按手动区域分流，国内走高德 Web 服务，海外走 Mapbox Static Images，并缓存到 R2。
- AI 标注：管理员配置 OpenAI 兼容代理后，上传页可生成标题、描述、标签、搜索内容、主色、色板和构图信息。

## 技术栈

| 层 | 选型 |
|---|---|
| 前端 | Vue 3.5、Vite 6、TypeScript、TailwindCSS、vue-router 4 |
| 地图 | 高德 JS API、高德 Web 服务静态地图、MapLibre GL、Mapbox Static Images、Three.js |
| 边缘 API | Cloudflare Pages Functions 文件路由 |
| 数据 | Cloudflare D1、Cloudflare R2、Telegram Bot API |
| 图像处理 | browser-image-compression、exifr、justified-layout |
| 测试 | Node 脚本测试、tsx、node:assert |

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
  _shared/                auth、http、images、folders、telegram、ai、静态地图、通行码等公共模块
  types.ts                Cloudflare Env binding 类型

db/migrations/            D1 迁移
db/schema.sql             D1 控制台初始化空库用的完整 schema
db/ai-prompt.example.md   AI 标注提示词示例，不在建库 SQL 里自动插入
tests/                    API、迁移、文件结构和 UI 行为测试
docs/PLAN.md              项目阶段计划与历史决策记录
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

`/upload`、`/library` 和 `/api/admin/*` 需要管理员身份。生产环境通过 Cloudflare Access JWT 校验管理员身份，不能只靠前端隐藏入口。

Cloudflare Access 用同一个域名即可，保护路径配置为 `/upload*`、`/library*`、`/api/admin/*`。`/api/list`、`/api/image/*`、`/api/public/*`、`/api/staticmap` 等公开接口不要加入 Access。

## API 摘要

| API | 方法 | 权限 | 用途 |
|---|---|---|---|
| `/api/list` | GET | 公开 | 公开图片列表、搜索、目录筛选、可选游标分页 |
| `/api/image/:key` | GET | 公开 | 单图公开详情，访客不能访问私有图 |
| `/api/public/:key` | GET | 公开 | 从 R2 回吐公开压缩图 |
| `/api/stats` | GET | 公开 | 首页统计 |
| `/api/folders` | GET | 公开 | 公开文件夹列表 |
| `/api/admin/me` | GET | 管理员 | 当前管理员身份探测 |
| `/api/admin/list` | GET | 管理员 | 管理员图片列表，包含私有图和隐藏位置 |
| `/api/admin/image/:key` | GET / PATCH / DELETE | 管理员 | 查看、更新或删除单图 |
| `/api/admin/image/:key/archive` | POST | 管理员 | Telegram 原图归档失败后重试 |
| `/api/admin/public/:key` | GET | 管理员 | 从 R2 回吐管理员可见压缩图 |
| `/api/admin/upload` | POST | 管理员 | 上传压缩图和元数据，后台归档原图 |
| `/api/admin/check-hash` | GET | 管理员 | 上传前去重 |
| `/api/admin/original/:key` | GET | 管理员 | 管理员下载原图 |
| `/api/admin/images/move` | POST | 管理员 | 批量移动图片 |
| `/api/admin/images/delete` | POST | 管理员 | 批量删除图片 |
| `/api/admin/folders` | GET / POST | 管理员 | 管理员文件夹列表和新建目录 |
| `/api/admin/folders/:id` | PATCH / DELETE | 管理员 | 重命名或删除目录 |
| `/api/admin/ai-settings` | GET / PATCH | 管理员 | AI 代理配置 |
| `/api/admin/ai/preview` | POST | 管理员 | 单次图片 AI 预览 |
| `/api/admin/download-grants` | GET / POST | 管理员 | 通行码列表和创建 |
| `/api/admin/download-grants/:id` | PATCH / DELETE | 管理员 | 更新或删除通行码 |
| `/api/download-grants/verify` | POST | 公开 | Turnstile / Cookie 挑战后校验通行码并返回授权图片 |
| `/api/download-grants/original/:key` | POST | 公开 | 用通行码下载原图 |
| `/api/amap-config` | GET | 公开 | 前端高德 JS API 配置 |
| `/api/mapbox-config` | GET | 公开 | 前端 Mapbox token 配置 |
| `/api/admin/geocode` | GET | 管理员 | 海外位置搜索代理 |
| `/api/staticmap` | GET | 公开 | 公开图公开位置可读 R2 静态图缓存 |
| `/api/admin/staticmap` | GET | 管理员 | 管理员位置静态图读取和缺失缓存生成 |

## 核心流程

### 上传与归档

1. 浏览器读取原图，计算 SHA-256，先调用 `/api/admin/check-hash` 做去重。
2. 浏览器用 `browser-image-compression` 压缩成 WebP，最长边限制为 2048。
3. 浏览器用 `exifr` 解析 EXIF，并可通过地图搜索或选点补充位置。
4. 如已配置 AI 代理，上传页可先调用 `/api/admin/ai/preview` 生成标题、描述、标签和搜索字段。
5. `/api/admin/upload` 校验表单，把压缩图写入 R2，把元数据写入 D1；只要位置坐标和 `location_region` 有效，并且对应地图 provider key 可用，就会预生成静态图并写入 R2，不再依赖图片或位置是否公开。
6. 原图通过 Telegram Bot 归档到私有频道，归档结果写回 `tg_status`。

R2 对象按用途分前缀：压缩图写入 `images/<uuid>`，静态地图缓存写入 `staticmap/amap_<lat>_<lng>_z<zoom>_600x360.png` 或 `staticmap/mapbox_<lat>_<lng>_z<zoom>_600x360.png`。公开图片地址默认走 `/api/public/images/<uuid>`，管理员图片地址走 `/api/admin/public/images/<uuid>`，都由 Pages Function 从 R2 回吐。

单张原图上限是 50MB，对齐 Telegram Bot API 的文件限制。原图只有 Telegram 这一份归档，Telegram 凭据失效时原图下载会不可用，但公开压缩图仍可从 R2 访问。

### 权限模型

鉴权逻辑在 [`functions/_shared/auth.ts`](functions/_shared/auth.ts)。

- 生产环境：hostname 不是 `localhost`、`127.0.0.1` 或 `0.0.0.0` 时，必须提供合法的 `Cf-Access-Jwt-Assertion`。后端会拉取 Access 公钥，校验 RS256 签名、`aud`、`iss`、`exp`，再使用 JWT 里的邮箱作为管理员身份。
- 本地开发：`X-Dev-Role` 请求头优先，其次是 `LOCAL_ROLE`，缺省为管理员。

不要用本地角色变量模拟生产权限。生产访问控制应由 Cloudflare Access 负责，并且需要配置 `CF_ACCESS_TEAM_DOMAIN` 和 `CF_ACCESS_AUD`。

写接口会校验浏览器 `Origin`。没有 `Origin` 的脚本请求可以通过；有 `Origin` 但不是本站的请求会返回 `403 invalid_origin`。

### 可见性模型

`images` 表里有两条独立开关：

- `is_public` 控制图片是否允许访客访问。私有图不会进入公开列表、搜索、随机和足迹，也不能通过 `/api/image/:key` 或 `/api/public/:key` 被访客直接读取。
- `location_public` 控制访客是否能看到地名和经纬度。

管理员始终看到完整记录。访客请求会经过 `scrubRecordForVisitor`，当 `location_public = 0` 时清空位置字段。

### 原图通行码

管理员在 `/library` 选择图片后可以生成限时验证码。验证码记录在 `download_grants`，授权图片关系记录在 `download_grant_images`。访客进入 `/access` 输入验证码后，只能下载该验证码覆盖的图片原图。

生产环境下，通行码校验会先走 Turnstile 挑战，并用 HttpOnly Cookie 记住通过挑战的访客。验证码连续失败会按访客 IP 和挑战 ID 做短窗口限流。本地开发没有 `TURNSTILE_SECRET_KEY` 且不是 Cloudflare 请求时会自动放行挑战，便于联调。

通行码相关的公开滥用流量建议放在 Cloudflare 边缘拦截，不写入业务数据库。可以在 WAF / Rate Limiting Rules 中按 IP 限制这些路径：

- `/api/download-grants/verify`
- `/api/download-grants/original/*`

`/api/admin/geocode` 和 `/api/admin/ai/preview` 需要管理员身份。`/api/staticmap` 允许访客读取公开图公开位置对应的 R2 缓存；没有公开可见位置或缓存未命中时返回 404，不会触发高德或 Mapbox。

### 地图与地理编码

- 国内搜索和选点走高德 JS API。
- 海外搜索通过管理员接口 `/api/admin/geocode`，优先 MapTiler，缺省回退到 Nominatim 和 Photon。
- 足迹页按 `location_region` 分国内和海外点位。
- 公开静态位置预览走 `/api/staticmap?lat=<lat>&lng=<lng>&region=<china|global>`，管理员预览走 `/api/admin/staticmap?lat=<lat>&lng=<lng>&region=<china|global>`。`region` 来自上传或编辑时选择的国内/国外搜索范围，不用经纬度自动猜。
- 上传和管理端修改位置时，只要坐标和 `location_region` 有效，就会尝试预生成静态图缓存。访客仍然必须通过 D1 可见性校验：只有公开图片且位置公开时，`/api/staticmap` 才会读取 R2 缓存；缓存未命中时返回 404，不会触发上游生成。
- 管理员 `/api/admin/staticmap` 可在缓存缺失时请求上游并回写 R2。国内上游是高德 Web 服务静态地图，海外上游是 Mapbox Static Images。
- 删除图片或修改位置时，会按坐标和区域检查是否还有其它图片引用同一张静态图。没人引用才删除 R2 里的旧静态图缓存，多张图共用同一坐标时会保留。

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

如果要在 Cloudflare D1 控制台手动初始化空库，可以直接执行 [`db/schema.sql`](db/schema.sql)。后续结构变更仍建议继续写入 `db/migrations`，不要在控制台零散改结构。

### 配置本地环境变量

本地 secrets 放在 `.dev.vars`。不要把真实 token 写进代码或提交到仓库。

```env
TG_BOT_TOKEN=
TG_CHAT_ID=
PROXY_KEY=
AMAP_JS_KEY=
AMAP_SECURITY_JS_CODE=
AMAP_WEB_KEY=
MAPBOX_PUBLIC_TOKEN=
MAPTILER_KEY=
CF_ACCESS_TEAM_DOMAIN=
CF_ACCESS_AUD=
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
| `AMAP_WEB_KEY` | 国内静态地图可选 | 高德 Web 服务 Key，只在服务端生成国内静态地图时使用 |
| `MAPBOX_PUBLIC_TOKEN` | 地图可选 | Mapbox public token，用于前端海外底图和海外静态图 |
| `MAPTILER_KEY` | 地理编码可选 | 海外位置搜索优先 provider |
| `CF_ACCESS_TEAM_DOMAIN` | 生产必需 | Cloudflare Access team domain，例如 `team.cloudflareaccess.com` |
| `CF_ACCESS_AUD` | 生产必需 | Cloudflare Access Application 的 AUD claim |
| `LOCAL_ROLE` | 本地可选 | `admin` 或 `visitor`，只在本地 hostname 生效 |

`PUBLIC_BASE_URL` 已在 [`wrangler.toml`](wrangler.toml) 里默认配置为 `/api/public`。公开图访问控制依赖这个 Pages Function 代理先查 D1，不要把它改成裸 R2 公开域名。管理员接口会自动返回 `/api/admin/public/*` 形式的图片地址。

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
4. 配置 Cloudflare Access，保护 `/upload*`、`/library*`、`/api/admin/*`，让管理员页面和管理 API 请求带上 Access JWT，并把 team domain 与 AUD 写入环境变量。
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

## 致谢

- 足迹页的边界地球交互参考并改写自 [lsy2246/newechoes](https://github.com/lsy2246/newechoes) 的 `WorldHeatmap` 实现。
- 中国行政区 GeoJSON 边界数据来自 [GeoJSON.CN](https://geojson.cn)，文件内保留了原始版权信息。

## License

Pixel Space 的源码按 [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/) 提供非商业使用授权。禁止销售、付费托管、并入商业产品或用于任何商业用途。详见 [LICENSE](./LICENSE)。
