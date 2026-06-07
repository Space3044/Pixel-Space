# AI 图片分析逻辑

这份文档说明当前项目里的 AI 图片分析是怎么工作的。它只描述现有实现，不设计新功能。

## 一句话说明

AI 分析发生在上传前。前端先把图片压缩成较小的预览图，调用 `/api/admin/ai/preview` 拿到标题、描述、标签、搜索词、主色、色板和构图建议，再把这些建议填进上传表单。管理员可以继续手动修改，最终上传接口只保存表单里的最终值。

模型不会直接写数据库。真正写入 D1 的地方仍然是 `/api/admin/upload`。

## 相关文件

- `src/features/upload/UploadView.vue`：上传页主流程，负责压缩图片、排队调用 AI、把结果填入表单。
- `src/features/upload/ai-preview.api.ts`：前端调用 `/api/admin/ai/preview` 的 API 封装。
- `functions/api/admin/ai/preview.ts`：AI 预览管理员接口。
- `functions/_shared/ai.ts`：读取 AI 配置、请求 OpenAI 兼容代理、清洗模型返回值。
- `functions/api/admin/ai-settings.ts`：管理员读取和保存 AI 配置。
- `functions/api/admin/upload.ts`：上传时保存最终 AI 字段。
- `functions/_shared/images.ts`：图片记录返回和标签、色板 JSON 规范化。
- `db/migrations/0001_init.sql`：`images` 的 AI 字段和 `ai_settings` 表。
- `db/ai-prompt.example.md`：可复制到管理控制台的提示词示例。

## 配置从哪里来

AI 配置分成两类。

`ai_settings` 表保存这三项：

- `proxy_url`：OpenAI 兼容代理地址，比如 `/v1/chat/completions` 风格的接口。
- `model`：要调用的模型名。
- `prompt`：系统提示词，要求模型按固定 JSON 结构输出。

新库初始化不会自动写入默认提示词。需要示例时，可以从 `db/ai-prompt.example.md` 复制到 `/library` 的 AI 配置面板里保存。

`PROXY_KEY` 只从 Cloudflare Secret / 环境变量读取。它不会写入 D1，也不会通过 `GET /api/admin/ai-settings` 返回给前端。

管理员在 `/library` 右侧的 AI 配置面板修改 `proxy_url`、`model` 和 `prompt`。对应接口是：

- `GET /api/admin/ai-settings`
- `PATCH /api/admin/ai-settings`

这两个接口都需要管理员身份。

## 前端怎么触发 AI 分析

上传页每个图片条目都有自己的处理状态。

图片加入队列后，前端先做这些事：

1. 计算原图 SHA-256，调用 `/api/admin/check-hash` 去重。
2. 读取 EXIF。
3. 把原图压缩成最终要上传的 WebP。
4. 读取压缩图尺寸。
5. 把该图片放进 AI 分析队列。

AI 队列最多同时跑 2 个任务，由 `AI_CONCURRENCY = 2` 控制。

AI 分析前，前端会准备一张更小的预览图：

- 如果压缩图不大，直接用压缩图。
- 如果压缩图超过 `768KB`，再压到最长边 `1280px` 左右。

这样做是为了减少传给模型代理的图片体积，降低接口延迟和费用。

管理员也可以点击“重新 AI 分析”。这个按钮不会立即上传图片，只是重新请求 `/api/admin/ai/preview`，再覆盖当前表单里的 AI 建议字段。

## `/api/admin/ai/preview` 做了什么

`POST /api/admin/ai/preview` 接收一个 `multipart/form-data` 请求，字段名是 `image`。

接口流程是：

1. 校验管理员身份。
2. 读取表单里的图片文件。
3. 拒绝缺失文件或非图片 MIME。
4. 从 `ai_settings` 读取 `proxy_url`、`model` 和 `prompt`。
5. 检查 `proxy_url`、`model` 和 `PROXY_KEY` 是否都存在。
6. 把图片转成 base64 data URL。
7. 按 OpenAI Chat Completions 格式请求代理。
8. 读取 `choices[0].message.content`。
9. 把模型返回内容解析成固定结构。
10. 返回清洗后的 JSON。

请求代理时，后端会发送两条 message：

- `system`：使用 D1 里的 `prompt`。
- `user`：一段固定提示词，加上图片 data URL。

固定提示词是：请分析这张图片，直接输出符合上述 Schema 的 JSON 对象。

## 模型必须返回哪些字段

后端期待模型返回一个 JSON 对象：

```json
{
  "title": "雾色山脊",
  "caption": "远处山脊被薄雾包围，冷色光线让画面显得安静。",
  "tags": ["山脉", "薄雾", "风景摄影", "冷色调"],
  "search_content": "山脉 山峰 薄雾 风景 冷色调 宁静 远景",
  "dominant_color": "雾蓝色 #64748B",
  "palette": ["#64748B", "#CBD5E1", "#0F172A"],
  "composition": "远景层次构图，山脊横向延展。"
}
```

字段含义：

- `title`：图片标题。
- `caption`：图片描述。
- `tags`：标签数组。
- `search_content`：搜索用关键词，空格分隔。
- `dominant_color`：主色，通常是中文色名加 HEX。
- `palette`：色板数组。
- `composition`：构图描述。

## 返回值怎么被清洗

模型有时会返回不够干净的内容，所以后端做了几层容错：

- 如果内容包在 ```json 代码块里，会先取出代码块内部。
- 如果内容前后夹了说明文字，会截取第一个 `{` 到最后一个 `}`。
- `tags` 和 `palette` 可以是数组，也可以是逗号、中文逗号或换行分隔的字符串。
- 标签和色板会去掉空值并去重。
- 字符串字段会 trim。
- 如果 `search_content` 为空，会用 `title + caption + tags` 拼出一个兜底搜索文本。

如果最终无法解析成 JSON，接口会返回 `500 ai_preview_failed`。

## 前端拿到结果后怎么处理

前端收到 AI 结果后，会写入当前图片条目的 `meta`：

- `title`：如果 AI 返回空标题，就保留原来的文件名标题。
- `caption`：写入图片描述。
- `tags`：数组转成逗号分隔字符串，方便表单编辑。
- `search_content`：写入搜索关键词。
- `dominant_color`：写入主色。
- `palette`：数组转成逗号分隔字符串。
- `composition`：写入构图描述。
- `ai_status`：成功时设为 `done`。

如果 AI 请求失败：

- `aiStatus` 设为 `failed`，用于上传页显示错误。
- `meta.ai_status` 设为 `failed`。
- 图片仍然可以上传。

## 上传时怎么保存

点击上传后，前端用 `buildUploadFormData` 把这些内容一起发给 `/api/admin/upload`：

- 原图 `original`
- 压缩图 `compressed`
- EXIF `exif`
- 表单元数据 `meta`
- 压缩图尺寸 `dimensions`

`/api/admin/upload` 不会重新调用 AI。它只读取 `meta` 里的最终值，并写入 `images` 表。

保存字段对应关系：

| 表单字段 | D1 字段 | 说明 |
|---|---|---|
| `title` | `title` | 图片标题 |
| `caption` | `caption` | 图片描述 |
| `tags` | `tags_json` | 后端转成 JSON 数组字符串 |
| `search_content` | `search_content` | 搜索关键词 |
| `dominant_color` | `dominant_color` | 主色 |
| `palette` | `color_palette_json` | 后端转成 JSON 数组字符串 |
| `composition` | `composition` | 构图描述 |
| `ai_status` | `ai_status` | `pending`、`done` 或 `failed` |

`tags` 和 `palette` 在上传接口里会再次规范化。它们可以来自 AI，也可以是管理员手动编辑后的文本。

## 展示和后续编辑

上传成功后，图片记录会通过 `rowToRecord` 返回给前端。

这些页面会使用 AI 字段：

- 探索页和详情 lightbox 展示标题、描述、标签、主色、色板和构图。
- 随机页展示 AI 分析信息。
- 图片管理弹窗可以继续编辑 AI 元数据。
- 搜索接口会使用 `search_content` 参与搜索。

后续编辑不是重新跑 AI，而是管理员直接修改字段，再通过 `PATCH /api/admin/image/:key` 保存。

## 失败情况怎么判断

常见失败点：

- `missing_ai_settings`：`proxy_url`、`model` 或 `PROXY_KEY` 缺失。
- `invalid_image_mime`：上传给 AI 预览的文件不是图片。
- `ai_preview_failed`：代理请求失败、代理返回非 2xx、返回体不是预期 JSON，或模型内容无法解析。

AI 失败只影响标注建议，不影响图片压缩、R2 上传、D1 写入和 Telegram 原图归档。

## 当前没有做什么

当前实现刻意保持简单：

- 没有上传后后台自动重跑 AI。
- 没有历史图片批量回填。
- 没有 Cloudflare Queues。
- 没有把 `PROXY_KEY` 存进数据库。
- 没有让模型直接改数据库。
- 没有把 OCR 文本作为额外输入。

如果以后要做批量回填或异步任务，应该复用 `functions/_shared/ai.ts` 的分析和清洗逻辑，避免前后两套规则不一致。

## 测试覆盖

现有测试覆盖了主要行为：

- `tests/ai-preview-api.test.mjs`：预览接口会读取配置、携带模型和 prompt、发送图片 data URL、规范化模型返回；缺配置时不会调用代理。
- `tests/ai-settings-api.test.mjs`：配置接口只读写 `proxy_url`、`model`、`prompt`，不暴露 `PROXY_KEY`。
- `tests/upload-api.test.mjs`：上传接口保存 `tags_json`、`search_content`、`dominant_color`、`color_palette_json`、`composition` 和 `ai_status`。
- `tests/upload-view.test.mjs`：上传页支持重新 AI 分析，结果会写回表单。
- `tests/library-view.test.mjs`：管理控制台有 AI 配置表单。
