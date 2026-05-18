# 个人图床实施计划

## 项目定位

这是一个个人自用图床。访客可以查看公开图片，管理员本人可以上传、删除、下载原图和维护图片信息。

运行环境以 Cloudflare 为主：前端部署在 Cloudflare Pages，接口使用 Pages Functions，元数据使用 D1，压缩图使用 R2，原图归档到 Telegram 私有频道。登录使用 Cloudflare Access + GitHub，只允许管理员账号进入管理区。

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
      SearchModal.vue
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
- D1 schema 随阶段渐进扩展，新增字段一律用 `ALTER TABLE ADD COLUMN`
- 不写本地 sqlite3 替代实现，运行时代码只认 D1
- 不做多用户、角色表、权限矩阵
- 不保存 EXIF GPS 字段，位置只支持管理员手动添加
- 不写假接口、假数据、冗余兜底分支
- 每阶段结束都要能运行 `npm test` 和 `npm run build`

## 关键技术决策

提前在这里说清楚几件容易在中途反复纠结的事，避免后面阶段临场决定。

**鉴权落地时机**。管理路径在第一次有真实写接口之前就用 Cloudflare Access 保护，不留裸奔窗口。本地开发用 `wrangler pages dev` 跑，Access 在边缘生效，本地 dev 不会触发，需要部署到 Pages Preview 才能完整验证。

**图片 key 策略**。key 使用 `crypto.randomUUID()` 生成，对外不可枚举。`hash` 列存 SHA-256，用于上传时前端展示"可能重复"提示，不强制阻塞。R2 对象 key 与 D1 主键一致。

**EXIF 处理路径**。在前端压缩之前用 `exifr` 读取拍摄时间、相机型号、ISO、光圈、快门等非定位字段，单独作为 FormData 字段发到后端。压缩使用 `browser-image-compression` 输出 WebP，会自然清除所有 EXIF，包括 GPS。不依赖后端做 EXIF 解析。

**AI 调用同步性**。上传接口返回时 `ai_status` 写 `pending`，AI 调用通过 `ctx.waitUntil` 在响应之后异步执行，不阻塞上传响应。失败重试上限 3 次，超过后 `ai_status` 写 `failed`，详情页展示原因，但不影响图片本身可用。当前阶段不引入 Cloudflare Queues，等流量真有压力再升级。

**Telegram 归档边界**。Bot API 单文件上传上限 50MB，当前阶段超过 50MB 直接拒绝上传，错误信息明确告诉用户。原图只存这一份，没有冗余备份，频道或 Bot 不可用就等于原图丢失，这一点写进 README。

**数据库迁移**。本地用 `wrangler d1 migrations apply imgbed --local` 跑，生产用 `wrangler d1 migrations apply imgbed --remote`。迁移文件按阶段编号，不修改已发布的迁移，新需求一律新增迁移。

**图库布局策略**。图库页用 Justified Rows 算法（Flickr/Unsplash 风格）：按行布局、每行图片高度统一、按原始宽高比横向拼接、行末等比缩放刚好填满容器宽度。不裁切原图、视觉密度高、阅读顺序自然。算法依赖每张图的 `width`/`height` 字段，因此到阶段 5 拿到真实数据后才能接入，候选实现是 [`justified-layout`](https://www.npmjs.com/package/justified-layout) 这个 Flickr 团队官方包，约 4 KB，框架无关。阶段 1 期间用 CSS columns 多列瀑布流 + 多种 aspect ratio 的骨架占位演示视觉密度，等阶段 5 替换为真算法。图库页通过 `AppShell` 的 `fluid` prop 跳出 `max-w-7xl` 限宽，撑满视口宽度。

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
- [x] 登录页写明 Cloudflare Access + GitHub 管理员登录入口
- [x] 上传页写出选图区域、缩略图队列、大图预览、EXIF 与表单侧栏
- [x] 图库页用 CSS columns 多列占位排布骨架卡片（阶段 5 替换为 Justified Rows）
- [x] 图片单图查看走 `ImageLightbox` 弹层（管理操作也挂在 lightbox 上，不再有独立的 `/images/:key` 详情路由）
- [x] 图库点击图片打开全屏 `ImageLightbox`（参考 PixelPunk：顶部 navbar、左右翻页箭头、底部控件条；缩放/旋转/详情等占位待阶段 7、5 接入）
- [x] 公开图片页写出单图展示结构
- [x] 随机页：参考 PixelPunk 沉浸式设计——首屏占满一张随机大图、向下滚动展开详情卡（作者、AI、文件信息）、右下浮动刷新按钮（loading 时 spin）、左下键盘提示（Space 换一张）；阶段 5 接 `GET /api/random` 真实数据
- [x] 蜂巢页：参考 PixelPunk 蜂窝马赛克设计——pointy-top 六边形 clip-path 密铺、奇偶行错位、深色渐变背景、浮动六边形装饰、左上角浮动提示卡（含收起按钮）；阶段 12 接入拖动浏览、全屏、滚动加载更多
- [x] 全局搜索弹窗骨架（`SearchModal.vue`）已写好，阶段 11 搜索接入时再挂载入口
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

任务：

- [ ] 新建 `db/migrations/0001_init.sql`
- [ ] 创建 `images` 表，字段：`key TEXT PK`、`title`、`caption`、`r2_key`、`width`、`height`、`format`、`bytes_compressed`、`bytes_original`、`hash`、`location_name`、`location_lat`、`location_lng`、`exif_taken_at`、`exif_camera`、`exif_iso`、`exif_aperture`、`exif_shutter`、`created_at`、`updated_at`
- [ ] 不创建任何 GPS 字段
- [ ] 不创建 AI 字段，不创建 Telegram 字段，等阶段 9、10 加列
- [ ] 添加公开列表查询所需索引（按 `created_at DESC`）
- [ ] 新建 `tests/migration.test.mjs`，校验迁移文件不含 `gps`、`latitude_exif`、`longitude_exif` 等关键字

这一阶段不做：

- 不建用户表、相册表、标签关联表、向量表
- 不写任何接口

验收：`npm test` 通过，迁移在本地 D1 能执行。

## 阶段 4：Cloudflare 本地开发配置

目标：让本地可以用 Wrangler 跑 Pages Functions 和 D1。

任务：

- [ ] 新建 `wrangler.toml`，配置 Pages 输出目录 `dist`、D1 binding `DB`、公开图基础 URL 变量
- [ ] 新建 `functions/types.ts`，定义 `Env` 类型，只包含本阶段会用到的 `DB` 和 `PUBLIC_BASE_URL`
- [ ] 新建 `tsconfig.functions.json`，加入 `npm run typecheck`
- [ ] `package.json` 增加 `db:migrate:local` 和 `db:migrate:remote` 脚本
- [ ] `package.json` 增加 `dev:pages` 脚本跑 `wrangler pages dev`
- [ ] README 或 PLAN 写明本地启动顺序

这一阶段不做：

- 不写任何业务接口
- 不写 R2 binding
- 不写 Telegram 密钥
- 不写 AI 密钥

验收：`npm run typecheck` 通过，本地 D1 执行迁移成功。

## 阶段 5：只读接口

目标：先让图库和详情能读取 D1。

任务：

- [ ] 新建 `functions/_shared/http.ts`，写最小 JSON 响应函数
- [ ] 新建 `functions/_shared/images.ts`，写 D1 行到 `ImageRecord` 的转换
- [ ] 实现 `GET /api/list`，按 `created_at DESC` 返回，无分页
- [ ] 实现 `GET /api/image/:key`
- [ ] 前端新建 `src/features/images/images.api.ts`
- [ ] 图库页调用列表接口，详情页调用详情接口
- [ ] 安装 `justified-layout`，把图库页的 CSS columns 占位换成 Justified Rows 真实布局
- [ ] 新建 `tests/api-shape.test.mjs`，断言响应字段集合（用 mock D1 或快照）

这一阶段不做：

- 不做分页、不做搜索、不做上传、不做删除、不做原图下载

验收：手动往本地 D1 插一条记录，图库和详情页能正确显示。

## 阶段 6：Cloudflare Access 前置

目标：在第一个写接口出现之前，把管理路径用 Cloudflare Access 保护起来。

任务：

- [ ] 在 Cloudflare Zero Trust 接入 GitHub 作为身份源
- [ ] 创建 Access Application，保护 `/upload`、`/api/upload`、`/api/original/*`、`/api/admin/*`
- [ ] 公开路径保持开放：`/`、`/images`、`/p/*`、`/api/list`、`/api/image/*`
- [ ] 邮箱白名单只放管理员 GitHub 账号绑定邮箱
- [ ] 部署一次 Pages Preview 验证保护生效
- [ ] 在 PLAN 或 README 记录 Access 应用 ID 和 AUD claim，供后续接口可选校验

这一阶段不做：

- 不写应用内用户表
- 不写角色权限表
- 不在前端保存登录 token
- 接口暂不验证 `Cf-Access-Jwt-Assertion`，由 Access 边缘直接拦截

验收：部署到 Pages Preview，未登录访问 `/upload` 跳到 GitHub 登录页；公开页面无需登录可访问。

## 阶段 7：上传页前端交互

目标：在浏览器里完成选图、读 EXIF、压缩、组装 FormData。

任务：

- [ ] 安装 `browser-image-compression` 和 `exifr`
- [ ] 上传页支持选择单张图片
- [ ] 显示本地预览、原始文件名、原始大小
- [ ] 用 `exifr` 读取拍摄时间、相机型号、ISO、光圈、快门
- [ ] 用 `browser-image-compression` 压缩为 WebP，目标长边 2048
- [ ] 显示压缩后大小
- [ ] 单图大小超过 50MB 直接在前端阻断，提示当前不支持
- [ ] 表单提供 `title`、`caption`、`location_name`、`location_lat`、`location_lng` 输入
- [ ] 组装 `FormData`：`original`、`compressed`、`exif`(JSON)、`meta`(JSON)
- [ ] 新建 `tests/exif.test.mjs`，覆盖典型 EXIF 数据解析

这一阶段不做：

- 不写多图批量上传
- 不写队列、断点续传
- 不调用后端

验收：选择一张图后能看到预览、压缩结果，控制台能打印组装好的 FormData 字段。`npm test` 通过。

## 阶段 8：上传闭环（D1 + R2）

目标：一次性把上传链路接通，避免中间态。

任务：

- [ ] 在 `wrangler.toml` 增加 R2 bucket binding `BUCKET`
- [ ] `Env` 类型增加 `BUCKET: R2Bucket`
- [ ] 新建迁移 `0002_add_r2_columns.sql`，确认 `r2_key` 列已可写（阶段 3 已建则跳过）
- [ ] 实现 `POST /api/upload`
- [ ] 接收 `multipart/form-data`，校验 MIME 是图片
- [ ] 用 `crypto.randomUUID()` 生成 `key`
- [ ] 计算 SHA-256 写入 `hash` 列
- [ ] 压缩图写入 R2，对象 key 与图片 key 一致
- [ ] D1 写入完整元数据，含 EXIF 非定位字段
- [ ] 接口响应返回新 `ImageRecord`
- [ ] 前端调用上传接口，成功后跳转详情页
- [ ] `GET /api/list` 和 `GET /api/image/:key` 返回 R2 公开 URL（基于 `PUBLIC_BASE_URL` 拼装）

这一阶段不做：

- 不接 Telegram
- 不接 AI
- 不做批量

验收：上传一张图后，R2 有压缩图对象、D1 有完整记录、图库和详情页能正常显示，公开页直链可访问。

## 阶段 9：Telegram 原图归档

目标：管理员上传时保留原图，访客不能直接拿到原图。

任务：

- [ ] 创建 Telegram Bot，创建私有频道，把 Bot 加入频道并设管理员
- [ ] 配置 `TG_BOT_TOKEN`、`TG_CHAT_ID`（通过 `wrangler secret` 写入）
- [ ] 新建迁移 `0003_add_tg_columns.sql`，增加 `tg_file_id`、`tg_message_id`、`tg_chat_id`
- [ ] 上传接口在写完 R2 和 D1 之后，把原图发送到 Telegram
- [ ] 发送失败时回滚或标记 `tg_status`，本期选择标记不阻塞上传（图片仍可用，只是没有归档）
- [ ] 实现 `GET /api/original/:key`，通过 Bot getFile 流式回吐原图
- [ ] 在 README 写明 50MB 上限和单副本风险

这一阶段不做：

- 不做删除同步（阶段 11 一起做）
- 不做批量下载
- 不公开原图链接（路径走 Access 保护）

验收：上传后 Telegram 频道里能看到原图，管理员通过 `/api/original/:key` 能下载，公开页面没有原图入口。

## 阶段 10：AI 标注异步流程

目标：上传后异步生成描述、标签、OCR 和搜索文本，不阻塞上传响应。

任务：

- [ ] 配置 `PROXY_URL`、`PROXY_KEY`（`wrangler secret`）
- [ ] 新建迁移 `0004_add_ai_columns.sql`，增加 `caption`、`tags_json`、`search_content`、`ocr_text`、`ai_status`（`pending|done|failed`）、`ai_error`、`ai_attempts`、`ai_model`、`ai_finished_at`
- [ ] 上传接口在响应前把 `ai_status` 写 `pending`
- [ ] 用 `ctx.waitUntil` 触发异步任务，调用 CLIProxyAPI
- [ ] 成功更新 AI 字段并把 `ai_status` 改为 `done`
- [ ] 失败重试上限 3 次，超过后写 `failed`，记录 `ai_error`
- [ ] 详情页展示 `ai_status` 和结果，`pending` 状态下提供刷新入口
- [ ] 新增管理接口 `POST /api/admin/reprocess/:key`，允许手动重跑（Access 保护）

这一阶段不做：

- 不做后台队列
- 不做批量回填
- 不做向量化

验收：上传后详情页很快返回，AI 完成后刷新能看到描述和标签。AI 失败时图片仍然存在，详情页显示错误状态。

## 阶段 11：删除、搜索、手动位置编辑

目标：补齐个人管理需要的基础能力。

任务：

- [ ] 实现 `DELETE /api/admin/image/:key`
- [ ] 删除流程：先删 R2 压缩图，再尝试删除 Telegram 频道消息（失败仅记录日志不阻塞），最后从 D1 物理删除
- [ ] 图库页增加关键词搜索，命中 `title`、`caption`、`search_content`、`location_name` 任一即可
- [ ] 详情页支持编辑 `title`、`caption`、`location_name`、`location_lat`、`location_lng`
- [ ] 详情页支持复制 Markdown、HTML、直链
- [ ] 公开页路由层注入 `og:image`、`og:title`、`og:description`

这一阶段不做：

- 不做标签表、不做相册、不做向量搜索

验收：管理员能删除图片、搜索图片、维护位置和描述。删除后 R2 和 D1 都已清理。

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
