# 个人图床实施计划

## 项目定位

这是一个个人自用图床。访客可以查看公开图片，管理员本人可以上传、删除、下载原图和维护图片信息。

运行环境以 Cloudflare 为主：前端部署在 Cloudflare Pages，接口使用 Pages Functions，元数据使用 D1，压缩图使用 R2，原图归档到 Telegram 私有频道。登录使用 Cloudflare Access 内置的 OTP（一次性邮箱验证码），白名单邮箱填 CF 账号绑定邮箱，效果接近"用 CF 账号登录"，无需配置任何外部 IdP。

当前代码已经退回到最小前端骨架。项目不再保留提前写好的后端、数据库迁移、API client、store、类型和示例业务逻辑，后续每个阶段再亲手补。

## 当前保留内容

```text
src/
  app/
    App.vue
    main.ts
    router.ts
  features/
    auth/
      LoginView.vue
    home/
      HomeView.vue
    hive/
      HiveView.vue
    images/
      GalleryView.vue
      ImageLightbox.vue
      PublicImageView.vue
    random/
      RandomView.vue
    upload/
      UploadView.vue
  shared/
    ui/
      AppShell.vue
  styles/
    main.css

docs/
  PLAN.md

tests/
  file-structure.test.mjs
  run-tests.mjs
```

当前只保留能启动、能路由、能显示页面的基础代码。页面里不接接口，不放假数据，不写临时兜底逻辑。

## 开发原则

- 每个阶段只完成当前阶段的任务
- 不提前写后续阶段需要的函数、字段、接口
- D1 schema 以 `db/migrations/0001_init.sql` 为当前新库基准，字段变更先回写这份初始化迁移
- 不写本地 sqlite3 替代实现，运行时代码只认 D1
- 不做多用户、角色表、权限矩阵
- 上传时若 EXIF 含 GPS 坐标，前端解析后作为默认值 pre-fill 到地图与表单；最终是否落库由管理员在提交前确认或调整，避免无意泄露敏感坐标
- 不写假接口、假数据、冗余兜底分支
- 每阶段结束都要能运行 `npm test` 和 `npm run build`

## 关键技术决策

提前在这里说清楚几件容易在中途反复纠结的事，避免后面阶段临场决定。

**鉴权落地时机与身份源**。管理路径在第一次有真实写接口之前就用 Cloudflare Access 保护，不留裸奔窗口。身份源选 Access 内置的 OTP（One-time PIN，邮箱一次性验证码）：白名单邮箱填 CF 账号绑定邮箱，体验等同于"用 CF 账号登录"，零外部依赖，无需创建 GitHub OAuth App 或其它 IdP。本地开发用 `wrangler pages dev` 跑，Access 在边缘生效，本地 dev 不会触发，需要部署到 Pages Preview 才能完整验证。

**管理员权限边界**。先把"谁能做什么"按接口和 UI 一次性定清楚，后续阶段写守卫时按此对齐，不再每次临场判定。

身份判定只用一个信号：`request.cf` 是否存在。Cloudflare 边缘运行时必然注入这个对象，`wrangler pages dev` 不会注入。所以后端的判定逻辑是：

- `request.cf` 不存在：当作本地开发，身份等同管理员（伪邮箱 `dev@local`）。
- `request.cf` 存在：必须带 `Cf-Access-Authenticated-User-Email` 请求头才算管理员，否则一律 401。

不读任何环境变量做兜底，也不维护应用内白名单——线上能进来的邮箱就是 Access 配置允许的邮箱，即为管理员。这条规则保证生产环境只有一条认证路径，没有任何环境变量可以反向打开口子。

**仅管理员可访问的接口**：

- `POST /api/upload`：写 D1、写 R2、归档 Telegram，所有写操作的入口。
- `POST /api/ai/preview`：把图片原图 base64 上行到外部 LLM 代理，消耗主人自己的 LLM 配额（不是 Cloudflare Workers AI）；同时属于敏感出站，必须锁。
- `GET /api/check-hash`：上传去重探测，本身无破坏性，但只在上传流里有用，跟 `/api/upload` 同权限收口防止刷库。
- `GET /api/original/:key`：从 Telegram 拉原图，原图属于管理员资产，不对公众开放。
- `PATCH /api/admin/image/:key`：编辑图片元数据（标题、说明、位置、标签、配色等）。
- `DELETE /api/admin/image/:key`：删除图片（清 R2 + D1，未来可能联动 TG 消息删除）。
- `GET /api/admin/ai-settings` / `PATCH /api/admin/ai-settings`：读写 AI 代理 URL 与模型配置。
- 新增辅助接口 `GET /api/admin/me`：返回当前管理员邮箱，未登录返回 401，供前端守卫和 UI 条件渲染使用。

**保持公开的接口**：

- `GET /api/list`：图库列表与搜索。
- `GET /api/image/:key`：单图公开元数据。
- `GET /api/public/:key`：R2 压缩图回吐（本地开发用，生产走 R2 公共域名直链）。
- `GET /api/geocode`：国外位置搜索代理，无破坏性，目前不锁；国内搜索走高德 JS API。
- 公开分享页 `/p/:key`、首页、图库 `/images`、随机 `/random`、蜂巢 `/hive` 等纯展示路由。

**前端权限点**：

- `/upload` 整页加路由守卫，未登录时跳转登录提示页或显示 403 占位。
- 图库 lightbox 与公开页里的"编辑/删除/复制原图链接"按钮根据 `/api/admin/me` 返回结果条件渲染。前端守卫只是 UX，真正的安全闸在后端。
- 前端通过共享 composable（`src/shared/auth/useAdmin.ts`）拿到 `{ email | null }` 状态，全局复用，避免每个组件单独 fetch。

**不做的事**：

- 不做角色分级（超管 / 普通管理员），凡是过了 Access 的邮箱权限等同。
- 不做应用内用户表、不做应用内邮箱白名单，名单交给 Access 维护。
- 当前阶段不在 Worker 内做 Cf-Access-Jwt-Assertion 签名校验，靠 Access 边缘拦截 + 邮箱头识别即可；如果未来需要进一步收紧，再拉取 `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` 做 JWT 验签。

**内容可见性模型**。在身份判定之外，每张图自带两个独立的可见性开关，分别控制"是否进入公开聚合"和"是否对外暴露位置"。管理员视角不受任何开关影响，看到的永远是真实数据；开关只决定访客视角看到什么。

两个开关都落在 `images` 表，由 `db/migrations/0001_init.sql` 直接创建：

- `is_public INTEGER NOT NULL DEFAULT 1`：是否公开到图库/探索/随机/蜂巢/足迹等任何聚合视图。`0` 表示"私藏"，访客在所有列表型接口里都看不到这张图，但只要拿到 `key` 仍可通过 `GET /api/image/:key` 与 `/p/:key` 直接访问（key 是 UUID 不可枚举，等同"凭直链可见"）。
- `location_public INTEGER NOT NULL DEFAULT 1`：是否对访客暴露位置。`0` 表示访客拿不到 `location_lat`、`location_lng`、`location_name`；详情页的地图区块仍然渲染，但是是一张**没有标记的空地图**，明确传达"作者保留了位置但选择不公开"的语义。无位置数据的图（lat/lng/name 全空）不渲染地图区块，与"有位置但不公开"在视觉上有别。

上传页表单新增两个开关：

- "公开到探索"：默认开。
- "显示位置"：默认开，仅在当前 `location_lat`/`location_lng` 有值时才生效；无坐标时开关置灰或隐藏。

接口层处理（统一在 `_shared/images.ts` 或同层加一个 `scrubForVisitor` 工具，避免每个接口各写一份）：

- **聚合型接口**（公开收口必须过滤 `is_public`）：`GET /api/list`、未来的 `/api/random`、`/api/hive`、`/api/footprint` 等任何"批量返回多张图"的接口，对访客一律加 `WHERE is_public = 1`；管理员视角不加过滤。
- **单图接口** `GET /api/image/:key` 与公开页 `/p/:key`：不按 `is_public` 拦（保留"凭直链分享私图"的能力），但对访客若 `location_public = 0`，把响应里的 `location_lat` / `location_lng` / `location_name` 置 null。
- **搜索接口**：访客侧搜索结果继承 `is_public = 1` 过滤；管理员搜索看全量。
- **足迹 / 地图聚合视图**（未实现，列入阶段 12）：对访客必须同时满足 `is_public = 1` 且 `location_public = 1` 才出现在地图上。

前端只在管理员视角下展示两个开关的状态徽标（如缩略图角标"私"、"位置隐藏"），方便管理员一眼识别。访客侧任何 UI 都不暗示这些开关的存在。

**图片 key 策略**。key 使用 `crypto.randomUUID()` 生成，对外不可枚举。`hash` 列存 SHA-256，用于上传时前端展示"可能重复"提示，不强制阻塞。R2 对象 key 与 D1 主键一致。

**EXIF 处理路径**。在前端压缩之前用 `exifr` 读取拍摄时间、相机型号、ISO、光圈、快门、焦距以及 GPS 经纬度，单独作为 FormData 字段发到后端。GPS 解析出 WGS84 十进制坐标后只作为**地图标记与表单的默认值**，最终是否随 `location_lat` / `location_lng` 落库由管理员在上传页确认或调整（可清空、可拖动地图覆盖、可手动改数字）。压缩使用 `browser-image-compression` 输出 WebP，会自然清除所有 EXIF（包括 GPS），公开访问的压缩图不会泄露原始坐标。不依赖后端做 EXIF 解析。

**AI 预览标注路径**。浏览器选图后先在前端读取 EXIF 并压缩为 WebP，再调用 `POST /api/ai/preview` 分析压缩图。AI 返回严格 JSON 后填入上传页表单，管理员可多次重跑，也可手动修改标题、描述、标签和搜索文本。最终上传只保存当前表单值。`PROXY_KEY` 只走 Cloudflare Secret，`proxy_url` 和 `model` 存在 D1 全局配置表 `ai_settings`，方便后期修改模型或代理地址。当前阶段不做上传后后台异步队列。

**Telegram 归档边界**。Bot API 单文件上传上限 50MB，当前阶段超过 50MB 直接拒绝上传，错误信息明确告诉用户。原图只存这一份，没有冗余备份，频道或 Bot 不可用就等于原图丢失，这一点写进 README。

**数据库迁移**。本地用 `wrangler d1 migrations apply imgbed --local` 跑，生产用 `wrangler d1 migrations apply imgbed --remote`。当前为了全新测试，迁移已整合为单一 `0001_init.sql`，作为新库基准。

**图库布局策略**。图库页用 Justified Rows 算法（Flickr/Unsplash 风格）：按行布局、每行图片高度统一、按原始宽高比横向拼接、行末等比缩放刚好填满容器宽度。不裁切原图、视觉密度高、阅读顺序自然。算法依赖每张图的 `width`/`height` 字段，因此到阶段 5 拿到真实数据后才能接入，候选实现是 [`justified-layout`](https://www.npmjs.com/package/justified-layout) 这个 Flickr 团队官方包，约 4 KB，框架无关。阶段 1 期间用 CSS columns 多列瀑布流 + 多种 aspect ratio 的骨架占位演示视觉密度，等阶段 5 替换为真算法。图库页通过 `AppShell` 的 `fluid` prop 跳出 `max-w-7xl` 限宽，撑满视口宽度。

**地图与坐标拾取**。平面地图统一接入高德 JS API 2.0，由官方底图处理国内中文、国外英文的地名展示。坐标入库仍保持 WGS84，前端展示和地图点击用 GCJ-02 转换，避免高德地图上的标记偏移。阶段 7 上传页用交互式地图让管理员点击地图拾取 `location_lat` / `location_lng`，地名先手动输入。阶段 10 lightbox 详情面板与 `/p/:key` 公开页复用同一套高德只读小地图配置。

## 阶段 0：最小骨架

目标：只保留主人后续亲手开发所需的基础项目壳。

状态：已完成。

任务：

- [x] 保留 Vite + Vue + TypeScript 基础入口
- [x] 保留 Tailwind 样式入口
- [x] 保留 Vue Router
- [x] 保留 `AppShell` 页面外壳
- [x] 保留登录、上传、图库、详情、公开图片 5 个空页面
- [x] 删除提前写好的前端 API client、Pinia store、图片类型
- [x] 删除提前写好的 Pages Functions 和 D1 迁移
- [x] 只保留一个最小结构测试

验收：

```bash
npm test
npm run build
```

## 阶段 1：静态页面结构

目标：把页面长什么样、有哪些区域写清楚，不接任何数据。

任务：

- [x] `AppShell` 完成导航和基础布局：左侧 Logo、中间「首页/探索/随机/上传/蜂巢」五项、右侧搜索按钮 + 语言/主题占位 + GitHub 链接 + 接入按钮
- [x] 首页写出 Hero 区域、CTA 按钮、站点数据占位（Photos/Storage/AI Tagged）和功能卡片
- [x] 登录页写明 Cloudflare Access 管理员登录入口（当前 UI 文案展示通用接入，阶段 6 选定 OTP 后 LoginView 文案与图标同步调整）
- [x] 上传页写出选图区域、缩略图队列、大图预览、EXIF 与表单侧栏
- [x] 图库页用 CSS columns 多列占位排布骨架卡片（阶段 5 替换为 Justified Rows）
- [x] 图片单图查看走 `ImageLightbox` 弹层（管理操作也挂在 lightbox 上，不再有独立的 `/images/:key` 详情路由）
- [x] 图库点击图片打开全屏 `ImageLightbox`（参考 PixelPunk：顶部 navbar、左右翻页箭头、底部控件条；缩放/旋转/详情等占位待阶段 7、5 接入）
- [x] 公开图片页写出单图展示结构
- [x] 随机页：参考 PixelPunk 沉浸式设计——首屏占满一张随机大图、向下滚动展开详情卡（作者、AI、文件信息）、右下浮动刷新按钮（loading 时 spin）、左下键盘提示（Space 换一张）；阶段 5 接 `GET /api/random` 真实数据
- [x] 蜂巢页：参考 PixelPunk 蜂窝马赛克设计——pointy-top 六边形 clip-path 密铺、奇偶行错位、深色渐变背景、浮动六边形装饰、左上角浮动提示卡（含收起按钮）；阶段 12 接入拖动浏览、全屏、滚动加载更多
- [x] 未接入的全局搜索弹窗不保留，后续需要搜索时再按实际入口实现
- [x] 在 `index.html` 写入基础 SEO 元信息（`description`、`og:title`、`og:type` 等）
- [x] 公开图片页路由层面预留 `og:image` 注入位置，当前阶段先留空
- [x] 样式只写当前页面用到的 class，不做主题系统

这一阶段不做：

- 不接 API
- 不写 store
- 不写假图片
- 不写上传逻辑
- 不写登录状态判断

验收：所有路由能打开，`npm run build` 通过。

## 阶段 2：前端图片模型与链接函数

目标：定义前端真正需要的数据结构，让页面可以围绕真实字段开发。

状态：已完成。

任务：

- [x] 新建 `src/features/images/image.types.ts`，定义 `ImageRecord`
- [x] 字段只包含 MVP 页面会展示的内容：`key`、`title`、`caption`、`public_url`、`width`、`height`、`format`、`location_name`
- [x] 新建 `src/features/images/image-links.ts`，实现 Markdown、HTML、公开页直链生成
- [x] 新建 `tests/image-links.test.mjs`，覆盖三种链接格式
- [x] `PublicImageView` 基于一个本地构造对象完成链接展示（详情已并入 lightbox，独立 detail 路由已删）
- [x] 当前阶段无跨页面共享需求，暂不引入 Pinia store

这一阶段不做：

- 不写上传函数
- 不写删除函数
- 不写原图下载函数
- 不定义后续阶段才会用到的字段

验收：`npm test` 通过，详情页能渲染并复制三种链接。阶段结束后删掉临时本地对象。

## 阶段 3：D1 最小 schema

目标：只先建 MVP 列表和详情页用得到的字段，后续阶段再加列。

状态：已完成。

任务：

- [x] 新建 `db/migrations/0001_init.sql`
- [x] 创建最终 `images` 表，字段以 `db/migrations/0001_init.sql` 为准；对象 key 与图片 `key` 共用，不再保留 `r2_key`、`bytes_original` 等冗余列
- [x] schema 不放 EXIF GPS 专属列：`location_lat` / `location_lng` 是通用坐标列，由阶段 7 上传链路提供值（EXIF 默认值经管理员确认，或地图手动拾取）
- [x] 初始化迁移已包含当前需要的 Telegram、AI、可见性和文件夹字段
- [x] 添加公开列表查询所需索引（按 `created_at DESC`）
- [x] 新建 `tests/migration.test.mjs`，校验迁移文件不含 `gps`、`latitude_exif`、`longitude_exif` 等关键字

这一阶段不做：

- 不建用户表、相册表、标签关联表、向量表
- 不写任何接口

验收：`npm test` 通过，迁移在本地 D1 能执行。

## 阶段 4：Cloudflare 本地开发配置

目标：让本地可以用 Wrangler 跑 Pages Functions 和 D1。

状态：已完成。

任务：

- [x] 新建 `wrangler.toml`，配置 Pages 输出目录 `dist`、D1 binding `DB`、公开图基础 URL 变量
- [x] 新建 `functions/types.ts`，定义 `Env` 类型，只包含本阶段会用到的 `DB` 和 `PUBLIC_BASE_URL`
- [x] 新建 `tsconfig.functions.json`，加入 `pnpm typecheck`
- [x] `package.json` 增加 `db:migrate:local` 和 `db:migrate:remote` 脚本
- [x] `package.json` 增加 `dev:pages` 脚本跑 `wrangler pages dev`
- [x] 本地启动顺序写明在下方

本地启动：

1. 安装依赖：`pnpm install`
2. 本地跑迁移：`pnpm db:migrate:local`（wrangler 只看 `wrangler.toml` 里的 `database_name`，把 schema 写到 `.wrangler/state/v3/d1/` 下的本地 SQLite 副本，**不需要远端 D1 实例存在**，`database_id` 留空也能跑）
3. 起前端开发服务器：`pnpm dev`（端口 5173，纯 Vite + HMR；`/api/*` 自动 proxy 到 8788）
4. 起 Pages Functions：`pnpm dev:pages`（端口 8788，binding 真实生效，接口由这边响应）

日常开发**同时开两个**：浏览器始终访问 5173 拿 HMR，接口请求经 vite proxy 落到 8788 的真 Functions。改前端代码无需 build，改 Functions 代码 wrangler 自动重启。

部署侧（**等真要发上线那一刻再做**）：

1. 在 Cloudflare Dashboard（dash.cloudflare.com → Workers & Pages → D1）手动创建数据库 `imgbed`，把返回的 `database_id` 填进 `wrangler.toml` 并提交
2. 同样在 Dashboard 建好 R2 bucket、Pages 项目设置页关联 D1 / R2 binding、Secrets（Telegram bot token、AI proxy key 等）也都在该页填
3. Git push 触发 Pages 自动构建部署前端 + Functions
4. 每次新增 `db/migrations/*.sql` 后，去 Dashboard 的 D1 Console 把新 SQL 文件内容贴进去手动执行一次

`pnpm db:migrate:remote` 这条脚本保留作为可选自动化路径，需要批量推迁移时再 `wrangler login` 用，日常不依赖。

这一阶段不做：

- 不写任何业务接口
- 不写 R2 binding
- 不写 Telegram 密钥
- 不写 AI 密钥

验收：`npm run typecheck` 通过，本地 D1 执行迁移成功。

## 阶段 5：只读接口

目标：先让图库和详情能读取 D1。

状态：已完成。

任务：

- [x] 新建 `functions/_shared/http.ts`，写最小 JSON 响应函数
- [x] 新建 `functions/_shared/images.ts`，写 D1 行到 `ImageRecord` 的转换
- [x] 实现 `GET /api/list`，按 `created_at DESC` 返回，无分页
- [x] 实现 `GET /api/image/:key`
- [x] 前端新建 `src/features/images/images.api.ts`
- [x] 图库页调用列表接口，详情页调用详情接口
- [x] 安装 `justified-layout`，把图库页的 CSS columns 占位换成 Justified Rows 真实布局
- [x] 新建 `tests/api-shape.test.mjs`，断言响应字段集合（mock D1）

这一阶段不做：

- 不做分页、不做搜索、不做上传、不做删除、不做原图下载

验收：手动往本地 D1 插一条记录，图库和详情页能正确显示。

## 阶段 6：Cloudflare Access 前置

目标：在第一个写接口出现之前，把管理路径用 Cloudflare Access 保护起来。

状态：本地代码已完成；Cloudflare Zero Trust 控制台配置与 Pages Preview 验证待部署时执行。

任务：

- [ ] 在 Cloudflare Zero Trust 启用 Access，选用内置的 OTP（One-time PIN）作为身份源，无需配置外部 IdP
- [ ] 创建 Access Application，保护 `/upload`、`/api/upload`、`/api/original/*`、`/api/admin/*`
- [ ] 公开路径保持开放：`/`、`/images`、`/p/*`、`/api/list`、`/api/image/*`
- [ ] 邮箱白名单只放管理员邮箱（CF 账号绑定邮箱）；首次访问受保护路径时 Access 发一次性 PIN 到该邮箱
- [x] 调整 LoginView UI：去掉 GitHub 字眼与图标，主按钮文案改为"邮箱验证码登录"，状态行 IdP 标签改为 OTP
- [ ] 部署一次 Pages Preview 验证保护生效
- [ ] 在 PLAN 或 README 记录 Access 应用 ID 和 AUD claim，供后续接口可选校验

Access 配置记录（控制台配置完成后回填）：

- Access Application ID：未配置
- AUD claim：未配置

这一阶段不做：

- 不写应用内用户表
- 不写角色权限表
- 不在前端保存登录 token
- 接口暂不验证 `Cf-Access-Jwt-Assertion`，由 Access 边缘直接拦截

验收：部署到 Pages Preview，未登录访问 `/upload` 跳到 Access OTP 邮箱验证码页面；公开页面无需登录可访问。

## 阶段 7：上传页前端交互

目标：在浏览器里完成选图、读 EXIF、压缩、组装 FormData。

状态：已完成。

任务：

- [x] 安装 `browser-image-compression` 和 `exifr`
- [x] 上传页支持选择单张图片
- [x] 显示本地预览、原始文件名、原始大小
- [x] 用 `exifr` 读取拍摄时间、相机型号、ISO、光圈、快门、焦距，以及 GPS 经纬度（若存在，解析为 WGS84 十进制）
- [x] 用 `browser-image-compression` 压缩为 WebP，目标长边 2048
- [x] 显示压缩后大小
- [x] 单图大小超过 50MB 直接在前端阻断，提示当前不支持
- [x] 接入高德 JS API 2.0，上传表单内嵌交互式地图：EXIF 含 GPS 时自动落点作为默认值，否则等待管理员点击地图拾取 `location_lat` / `location_lng`
- [x] 表单提供 `title`、`caption`、`location_name` 输入；`location_lat` / `location_lng` 由 EXIF / 地图拾取自动回填，可清空、可手动覆盖；提交时由管理员确认是否随图落库
- [x] 组装 `FormData`：`original`、`compressed`、`exif`(JSON)、`meta`(JSON)
- [x] 新建 `tests/exif.test.mjs`，覆盖典型 EXIF 数据解析

这一阶段不做：

- 不写多图批量上传
- 不写队列、断点续传
- 不调用后端
- 不接 OSM Nominatim 地名搜索；当前阶段用手动位置名输入 + 地图点选坐标，避免把输入内容发给外部搜索服务

验收：选择一张图后能看到预览、压缩结果，控制台能打印组装好的 FormData 字段。`npm test` 通过。

## 阶段 8：上传闭环（D1 + R2）

目标：一次性把上传链路接通，避免中间态。

状态：已完成。

任务：

- [x] 在 `wrangler.toml` 增加 R2 bucket binding `BUCKET`
- [x] `Env` 类型增加 `BUCKET: R2Bucket`
- [x] 使用图片 `key` 作为 R2 对象 key，`0001_init.sql` 直接包含 EXIF 焦距字段
- [x] 实现 `POST /api/upload`
- [x] 接收 `multipart/form-data`，校验 MIME 是图片
- [x] 用 `crypto.randomUUID()` 生成 `key`
- [x] 计算 SHA-256 写入 `hash` 列
- [x] 压缩图写入 R2，对象 key 与图片 key 一致
- [x] D1 写入完整元数据，含 EXIF 拍摄信息以及管理员确认后的 `location_lat` / `location_lng` / `location_name`（未填则留空）
- [x] 接口响应返回新 `ImageRecord`
- [x] 前端调用上传接口，成功后在上传页展示图片直链、Markdown、HTML 和公开页链接
- [x] `GET /api/list` 和 `GET /api/image/:key` 返回 R2 公开 URL（基于 `PUBLIC_BASE_URL` 拼装）；本地默认 `PUBLIC_BASE_URL=/api/public`，由 `GET /api/public/:key` 从 R2 回吐压缩图

这一阶段不做：

- 不接 Telegram
- 不接 AI
- 不做批量

验收：上传一张图后，R2 有压缩图对象、D1 有完整记录、图库和详情页能正常显示，公开页直链可访问。

## 阶段 9：Telegram 原图归档

目标：管理员上传时保留原图，访客不能直接拿到原图。

状态：代码已完成；真实 Telegram 频道归档待配置 `TG_BOT_TOKEN` / `TG_CHAT_ID` 后验证。

任务：

- [ ] 创建 Telegram Bot，创建私有频道，把 Bot 加入频道并设管理员
- [ ] 配置 `TG_BOT_TOKEN`、`TG_CHAT_ID`（通过 `wrangler secret` 写入）
- [x] 新建迁移 `0003_add_tg_columns.sql`，增加 `tg_file_id`、`tg_message_id`、`tg_chat_id`、`tg_status`、`tg_error`
- [x] 上传接口在写完 R2 和 D1 之后，把原图发送到 Telegram
- [x] 发送失败时标记 `tg_status='failed'`，不阻塞上传（图片仍可用，只是没有归档）
- [x] 实现 `GET /api/original/:key`，通过 Bot getFile 流式回吐原图
- [x] 在 README 写明 50MB 上限和单副本风险

这一阶段不做：

- 不做删除同步（阶段 10 一起做）
- 不做批量下载
- 不公开原图链接（路径走 Access 保护）

验收：上传后 Telegram 频道里能看到原图，管理员通过 `/api/original/:key` 能下载，公开页面没有原图入口。

## 阶段 10：删除、搜索、手动位置编辑

目标：补齐个人管理需要的基础能力。

状态：已完成。

任务：

- [x] 实现 `DELETE /api/admin/image/:key`
- [x] 删除流程：先删 R2 压缩图，再尝试删除 Telegram 频道消息（失败仅记录日志不阻塞），最后从 D1 物理删除
- [x] 图库页增加关键词搜索，命中 `title`、`caption`、`location_name` 任一即可；AI 接入后再扩展到 `search_content`
- [x] 详情页支持编辑 `title`、`caption`、`location_name`、`location_lat`、`location_lng`（坐标编辑复用高德地图拾取组件）
- [x] lightbox 详情面板与 `/p/:key` 公开页用只读高德地图渲染坐标小地图（无坐标则不显示）
- [x] 详情页支持复制 Markdown、HTML、直链
- [x] 公开页路由层注入 `og:image`、`og:title`、`og:description`

这一阶段不做：

- 不做标签表、不做相册、不做向量搜索

验收：管理员能删除图片、搜索图片、维护位置和描述。删除后 R2 和 D1 都已清理。

## 阶段 11：AI 预览标注流程

目标：选图后生成描述、标签和搜索文本，先填充预览表单，再由管理员确认上传。

任务：

- [x] 支持 `PROXY_KEY` 走 `wrangler secret`，代理 URL 和模型名写入 D1 的 `ai_settings`，方便后期修改
- [x] 新建迁移 `0004_add_ai_columns.sql`，给 `images` 增加 `tags_json`、`search_content`、`ai_status`（`pending|done|failed`）、`ai_error`、`ai_attempts`、`ai_finished_at`，并创建全局配置表 `ai_settings(proxy_url, model)`
- [x] 新增 `GET/PATCH /api/admin/ai-settings`，只读写 `proxy_url` 和 `model`，不返回、不保存 `PROXY_KEY`
- [x] 新增 `POST /api/ai/preview`，从 `ai_settings` 读取 `proxy_url` / `model`，用 `PROXY_KEY` 调 CLIProxyAPI/OpenAI-compatible 接口
- [x] 上传页在压缩完成后自动调用 AI 预览，把 JSON 结果填进表单
- [x] 上传页支持“重新 AI 分析”，并保留手动修改标题、描述、标签、搜索文本
- [x] 上传接口保存当前表单里的 `tags_json`、`search_content`、`ai_status`
- [x] 新增迁移 `0005_add_original_filename.sql`，保存浏览器上传时的原始文件名；详情展示和原图下载文件名使用该字段，TG 取回仍然走 `key -> tg_file_id`
- [x] 详情页展示 AI 标签

这一阶段不做：

- 不做后台队列
- 不做批量回填
- 不做向量化
- 不做上传后异步 `ctx.waitUntil` 重跑
- 不做每张图片记录 `proxy_url` / `model`

验收：选择图片后自动出现 AI 建议，管理员能重跑或手动修改；上传成功后 D1 保存最终表单里的标签、搜索文本和 AI 状态。

## 阶段 12：后续增强

这些任务等 MVP 稳定后再做，目前不展开任务清单。

- [ ] 标签表和标签筛选
- [ ] FTS5 全文搜索
- [ ] 相册
- [ ] Vectorize 语义搜索
- [ ] 相似图和重复图检测
- [ ] 历史图片 AI 批量回填
- [ ] Cloudflare Queues 接管 AI 任务
- [ ] 原图二级归档（例如另一个 Telegram 频道或 R2 冷存储）
- [ ] 抽一个统一进度条组件，后续上传、AI 处理、批量回填等遇到进度展示时统一套用
