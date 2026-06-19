仓库地址：https://github.com/Space3044/Pixel-Space

这篇文章主要分析 Pixel Space 项目的架构设计

---

## 技术栈

### 前端

- Vue 3、Vite、TypeScript、Vue Router
- Tailwind CSS
- browser-image-compression：浏览器侧图片压缩
- exifr：EXIF 和 GPS 信息读取
- justified-layout：公开图库瀑布流布局
- MapLibre GL、Three.js：足迹地图和边界地球

### 边缘后端

- Cloudflare Pages Functions
- TypeScript
- Wrangler
- Cloudflare Access JWT 鉴权

### 数据和对象存储

- Cloudflare D1：图片元数据、目录、AI 配置、原图授权关系
- Cloudflare R2：压缩图、静态地图缓存
- Telegram Bot API：原图归档和原图下载

### 地图和 AI

- 高德 JS API：国内地图、搜索和选点
- 高德 Web 服务：国内静态地图
- Mapbox / MapLibre：海外地图和静态图
- MapTiler、Nominatim：海外地理编码兜底
- OpenAI 兼容接口：图片 AI 标注

## 目录结构

```text
src/
  app/                  路由和应用入口
  features/
    images/             公开图库、图片详情、灯箱、图片 API 封装
    upload/             上传工作台、压缩、EXIF、位置选择、上传流程
    library/            管理员控制台、目录管理、原图授权
    footprints/         旅行足迹地图、聚合点、边界地球
    access/             原图通行码访问页
    auth/               Cloudflare Access 登录引导
  shared/
    api/                前端请求工具
    auth/               前端管理员状态
    ui/                 通用 UI 组件

functions/
  api/                  Pages Functions API 路由
    admin/              管理员接口
    public/             公开图片代理
    download-grants/    原图通行码接口
  _shared/              鉴权、图片记录转换、上传、归档、静态地图等共享逻辑
  types.ts              Functions 环境绑定类型

db/
  migrations/           D1 迁移
  schema.sql            当前数据库结构
```

## 架构分层

Pixel Space 当前可以拆成四层。

```text
Vue 前端
  |
  | 上传、浏览、管理、足迹、通行码
  v
Cloudflare Pages Functions
  |
  | 鉴权、校验、编排、代理访问
  v
D1 元数据  <---->  R2 压缩图 / 静态地图缓存
  |
  +---- Telegram 原图归档
  +---- 高德 / Mapbox 地图服务
  +---- OpenAI 兼容 AI 代理
```

### 前端层

Vue 前端负责页面交互和浏览器侧预处理。

- 公开图库、单图详情、随机图片、旅行足迹
- 上传工作台、控制台、原图通行页
- 图片压缩、EXIF 读取、上传队列、AI 预览

### 边缘 API 层

Cloudflare Pages Functions 负责请求入口和轻量业务编排。

- 管理员鉴权
- 上传参数校验
- 图片列表和详情查询
- 公开图片代理
- 静态地图缓存
- AI 预览和图片元数据编辑
- 原图下载授权

### 数据层

D1 保存结构化数据。

- 图片元数据
- 目录结构
- AI 配置
- 原图下载授权关系

### 对象和外部服务层

R2 和外部服务负责大对象存储或外部能力。

- R2：压缩图、静态地图缓存
- Telegram 私有频道：原图归档
- 高德 / Mapbox：地图和地理能力
- OpenAI 兼容代理：图片标注

## 访问控制边界

### 前端路由不是安全边界

上传页和控制台在前端路由中标记为管理员页面。

```ts
// src/app/router.ts 节选
{
  path: '/upload',
  name: 'upload',
  component: () => import('@/features/upload/UploadView.vue'),
  meta: {
    title: '上传',
    requiresAdmin: true,
  },
},
{
  path: '/library',
  name: 'library',
  component: () => import('@/features/library/LibraryView.vue'),
  meta: {
    title: '控制台',
    requiresAdmin: true,
  },
},
```

这只负责前端体验。管理员接口仍然由后端鉴权。

### 管理员身份由后端解析

生产环境只信 Cloudflare Access 注入的 JWT。本地开发环境允许用 `X-Dev-Role` 或 `LOCAL_ROLE` 模拟身份。

```ts
// functions/_shared/auth.ts 节选
export const resolveAdmin = async (
  request: Request,
  env: Env,
): Promise<AdminIdentity | null> => {
  const hostname = new URL(request.url).hostname;
  const isLocal = LOCAL_HOSTS.has(hostname);

  if (!isLocal) {
    const jwt = request.headers.get('Cf-Access-Jwt-Assertion')?.trim() ?? '';
    return jwt ? await verifyAccessJwt(jwt, env) : null;
  }

  const headerRole = request.headers.get('X-Dev-Role')?.trim().toLowerCase();
  const envRole = env.LOCAL_ROLE?.trim().toLowerCase();
  const role = headerRole || envRole || 'admin';
  return role === 'visitor' ? null : { email: DEV_ADMIN_EMAIL };
};
```

### R2 不直接公开

公开图片通过 `/api/public/:key` 代理访问。接口先查 D1，确认图片仍然公开，再读取 R2 对象。

```ts
// functions/api/public/[[key]].ts 节选
const row = await env.DB
  .prepare('SELECT is_public FROM images WHERE key = ?')
  .bind(key)
  .first<VisibilityRow>();

if (!row) return notFound();
if (row.is_public !== 1) return notFound();

const object = await env.BUCKET.get(key);
if (!object) return notFound();

const headers = new Headers();
object.writeHttpMetadata(headers);
headers.set('etag', object.httpEtag);
headers.set('cache-control', 'public, max-age=31536000, immutable');

return new Response(object.body, { headers });
```

这层代理让公开状态可以回收。R2 只保存对象，访问权限由 D1 和 API 判断。

### 公开读取使用边缘缓存

公开图片代理会优先读取 Cloudflare edge cache。未命中时读取 R2，再写入缓存。

```ts
const cache = edgeCache();
const cacheKey = new Request(request.url, { method: 'GET' });
const cached = cache ? await cache.match(cacheKey) : undefined;
if (cached) return cached;

const response = new Response(object.body, { headers });
if (cache) {
  const cacheWrite = cache.put(cacheKey, response.clone());
  context.waitUntil(cacheWrite);
}
```

## 数据模型

### images 表

`images` 表保存图片元数据和业务状态，不保存图片二进制内容。

```sql
CREATE TABLE images (
  key                TEXT    PRIMARY KEY NOT NULL,
  title              TEXT    NOT NULL DEFAULT '',
  caption            TEXT,
  original_filename  TEXT    NOT NULL DEFAULT '',
  width              INTEGER NOT NULL,
  height             INTEGER NOT NULL,
  format             TEXT    NOT NULL,
  bytes_compressed   INTEGER NOT NULL,
  hash               TEXT    NOT NULL,
  location_name      TEXT,
  location_lat       REAL,
  location_lng       REAL,
  location_region    TEXT,
  exif_taken_at      TEXT,
  exif_camera        TEXT,
  exif_iso           INTEGER,
  exif_aperture      REAL,
  exif_shutter       TEXT,
  exif_focal_length  REAL,
  tg_file_id         TEXT,
  tg_message_id      INTEGER,
  tg_chat_id         TEXT,
  tg_status          TEXT    NOT NULL DEFAULT 'pending',
  tg_error           TEXT,
  tags_json          TEXT,
  search_content     TEXT,
  ai_status          TEXT    NOT NULL DEFAULT 'pending',
  created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  dominant_color     TEXT,
  color_palette_json TEXT,
  composition        TEXT,
  is_public          INTEGER NOT NULL DEFAULT 1,
  location_public    INTEGER NOT NULL DEFAULT 1,
  folder_id          TEXT REFERENCES folders(id)
);
```

### 字段类型

`INTEGER` 用于整数值。项目里保存宽高、压缩后字节数、EXIF ISO、Telegram message id，也用 `0 / 1` 表示开关。

```sql
width              INTEGER NOT NULL,
height             INTEGER NOT NULL,
bytes_compressed   INTEGER NOT NULL,
is_public          INTEGER NOT NULL DEFAULT 1,
location_public    INTEGER NOT NULL DEFAULT 1
```

`REAL` 用于浮点数。项目里保存经纬度、光圈、焦距。

```sql
location_lat       REAL,
location_lng       REAL,
exif_aperture      REAL,
exif_focal_length  REAL
```

`REFERENCES folders(id)` 是外键声明，表示图片可以归属到 `folders` 表中的某个目录。

```sql
folder_id TEXT REFERENCES folders(id)
```

上传时会检查目录是否存在。

```ts
// functions/_shared/upload.ts 节选
if (meta.folder_id) {
  const folderRow = await env.DB
    .prepare('SELECT id FROM folders WHERE id = ?')
    .bind(meta.folder_id)
    .first<{ id: string }>();

  if (!folderRow) return badRequest('folder_not_found');
}
```

### 索引

`images` 表当前有四条索引：

```sql
CREATE INDEX idx_images_created_at ON images (created_at DESC);
CREATE INDEX idx_images_hash ON images (hash);
CREATE INDEX idx_images_is_public_created_at ON images (is_public, created_at DESC);
CREATE INDEX idx_images_folder_id ON images (folder_id);
```

| 索引 | 对应查询场景 | 作用 |
| --- | --- | --- |
| `idx_images_created_at` | 管理员图片列表、无筛选图片列表 | 支持按 `created_at DESC` 倒序读取，避免每次列表查询都从全表重新排序。 |
| `idx_images_hash` | 上传前按 hash 查重 | 让去重查询可以直接按 `hash` 定位已有图片。 |
| `idx_images_is_public_created_at` | 公开图库列表 | 同时服务 `WHERE is_public = 1` 和 `ORDER BY created_at DESC`，适合访客侧公开图片流。 |
| `idx_images_folder_id` | 控制台按目录筛选图片 | 支持通过 `folder_id` 找到某个目录下的图片。 |

`idx_images_created_at` 对应列表页的时间线读取。后台查看全部图片时，查询会按创建时间倒序返回。

`idx_images_hash` 用于上传去重。

```ts
// functions/_shared/upload.ts 节选
const existing = await env.DB
  .prepare(SELECT_BY_HASH_SQL)
  .bind(hash)
  .first<ImageRow>();

if (existing) {
  return json(rowToRecord(existing, env.PUBLIC_BASE_URL), 200);
}
```

`idx_images_is_public_created_at` 用于公开图库查询，先过滤 `is_public = 1`，再按创建时间倒序。

`idx_images_folder_id` 用于控制台目录筛选。

索引没有覆盖所有字段。这里的设计只针对稳定、高频的查询路径：时间线列表、上传去重、公开图库、目录筛选。

索引的代价也需要考虑。每次插入、更新或删除图片记录时，数据库除了修改表数据，还要同步维护相关索引。因此索引会增加写入成本和存储占用。对于低频查询字段，如果提前全部建索引，读性能不一定明显改善，反而会拖慢上传、编辑和批量删除这类写操作。

## 读链路

### 管理员视图

管理员响应保留完整字段，图片地址走 `/api/admin/public/:key`。

```ts
// functions/_shared/images.ts 节选
export const ADMIN_PUBLIC_BASE_URL = '/api/admin/public';

export function rowToRecord(
  row: ImageRow,
  publicBaseUrl: string,
): ImageRecord {
  return {
    key: row.key,
    title: row.title,
    public_url: `${publicBaseUrl.replace(/\/$/, '')}/${row.key}`,
    location_name: row.location_name,
    search_content: row.search_content,
    is_public: row.is_public,
    location_public: row.location_public,
    // 其它字段省略
  };
}

export function rowToAdminRecord(row: ImageRow): ImageRecord {
  return rowToRecord(row, ADMIN_PUBLIC_BASE_URL);
}
```

### 访客视图

访客响应会移除 `search_content`。当 `location_public = 0` 时，位置字段也会被置空。

```ts
// functions/_shared/images.ts 节选
export function scrubRecordForVisitor(record: ImageRecord): ImageRecord {
  const { search_content: _searchContent, ...visitorRecord } = record;
  return {
    ...visitorRecord,
    ...(visitorRecord.location_public === 0
      ? {
          location_name: null,
          location_lat: null,
          location_lng: null,
          location_region: null,
        }
      : {}),
  };
}
```

### 搜索条件

管理员搜索包含完整字段。访客搜索 `location_name` 时，需要同时满足 `location_public = 1`。

```ts
// functions/_shared/list-images.ts 节选
if (search) {
  if (options.admin) {
    conditions.push(
      '(title LIKE ? OR caption LIKE ? OR original_filename LIKE ? OR location_name LIKE ? OR search_content LIKE ? OR dominant_color LIKE ? OR composition LIKE ?)',
    );
  } else {
    conditions.push(
      '(title LIKE ? OR caption LIKE ? OR original_filename LIKE ? OR (location_public = 1 AND location_name LIKE ?) OR search_content LIKE ? OR dominant_color LIKE ? OR composition LIKE ?)',
    );
  }
}
```

## 写链路

### 上传流程

上传主流程：

```text
管理员鉴权
  -> 解析 FormData
  -> 校验 original / compressed / hash / exif / meta / dimensions
  -> hash 去重
  -> 写入 R2 压缩图
  -> 写入 D1 图片记录
  -> 异步归档原图
```

关键写入代码：

```ts
// functions/_shared/upload.ts 节选
const existing = await env.DB
  .prepare(SELECT_BY_HASH_SQL)
  .bind(hash)
  .first<ImageRow>();

if (existing) {
  return json(rowToRecord(existing, env.PUBLIC_BASE_URL), 200);
}

await env.BUCKET.put(key, compressed, {
  httpMetadata: {
    contentType: compressed.type,
  },
});
r2ObjectWritten = true;

await env.DB.prepare(INSERT_SQL)
  .bind(/* 字段省略 */)
  .run();
d1ImageInserted = true;
```

### R2 和 D1 的补偿

R2 与 D1 不在同一个事务内。若 R2 写入成功但 D1 写入失败，会删除刚写入的 R2 对象。

```ts
// functions/_shared/upload.ts 节选
if (r2ObjectWritten && !d1ImageInserted) {
  try {
    await env.BUCKET.delete(key);
  } catch (cleanupError) {
    logger.error('R2 cleanup failed', {
      error: cleanupError,
      context: { key },
    });
  }
}
```

### 原图归档异步化

原图归档不阻塞上传响应。Cloudflare 环境下通过 `context.waitUntil` 执行。

```ts
// functions/_shared/upload.ts 节选
if (typeof context.waitUntil === 'function') {
  context.waitUntil(deferTask(() =>
    archiveOriginalAfterUpload(env, original, key, logger),
  ));
} else {
  await archiveOriginalAfterUpload(env, original, key, logger);
}
```

## 架构取舍

### API 代理 R2

公开图片不直接暴露 R2 地址，而是经过 Pages Functions 查询 D1 后代理返回。代价是多一层接口，收益是公开状态可以由应用层控制。

### D1 保存元数据，R2 保存对象

D1 负责查询、筛选和状态管理。R2 负责图片对象和静态地图缓存。两者通过 `images.key` 关联。

### 浏览器侧压缩

图片压缩放在浏览器侧完成，后端接收压缩后的 WebP 和元数据。这样避免在 Pages Functions 中做重型图片处理。

### 原图归档异步处理

原图归档通过 Telegram 私有频道完成，失败不影响压缩图展示和元数据写入。归档状态由 `tg_status`、`tg_error` 等字段记录。
