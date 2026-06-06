import type { Env } from '../types';
import { badRequest, json, serverError } from './http';
import { collectDescendantIds } from './folders';
import type { ImageRow } from './images';
import { IMAGE_SELECT_COLUMNS, rowToAdminRecord, rowToRecord, scrubRecordForVisitor } from './images';

// 列表与搜索共用一套动态拼接的 SQL：根据 admin / 是否带搜索 / 是否带 folder 参数决定 WHERE。
// 访客视角强制 is_public=1，并把 location_name 搜索包在 location_public=1 守卫里。

const normalizeSearch = (request: Request): string => {
  const value = new URL(request.url).searchParams.get('q') ?? '';
  return value.trim().slice(0, 100);
};

const MAX_PAGE_SIZE = 96;

interface PageCursor {
  createdAt: string;
  key: string;
}

interface Pagination {
  limit: number;
  cursor: PageCursor | null;
}

const encodeCursor = (row: ImageRow): string =>
  encodeURIComponent(JSON.stringify([row.created_at, row.key]));

const decodeCursor = (value: string): PageCursor | null => {
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const [createdAt, key] = parsed;
    if (typeof createdAt !== 'string' || typeof key !== 'string') return null;
    if (!createdAt || !key) return null;
    return { createdAt, key };
  } catch {
    return null;
  }
};

const parsePagination = (request: Request): Pagination | null | 'invalid' => {
  const url = new URL(request.url);
  const rawLimit = url.searchParams.get('limit');
  if (rawLimit === null) return null;

  const parsedLimit = Number(rawLimit);
  if (!Number.isFinite(parsedLimit)) return 'invalid';
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(parsedLimit)));

  const rawCursor = url.searchParams.get('cursor');
  if (!rawCursor) return { limit, cursor: null };

  const cursor = decodeCursor(rawCursor);
  return cursor ? { limit, cursor } : 'invalid';
};

interface FolderFilter {
  // bare=true 表示「未分类」（folder_id IS NULL）。
  // ids 在 bare=false 时存放：目标文件夹自己 + （recursive=1 时的所有后代）。
  bare: boolean;
  ids: string[];
}

// folder 参数取值：
//   `__none__` / `null` / `none` -> 未分类
//   其它非空字符串 -> 目标 folder_id
//   缺省 / 空字符串 -> 不过滤
const parseFolderParam = async (
  request: Request,
  db: D1Database,
): Promise<FolderFilter | null | 'invalid'> => {
  const url = new URL(request.url);
  const raw = url.searchParams.get('folder');
  if (raw === null || raw === '') return null;

  const normalized = raw.trim().toLowerCase();
  if (normalized === '__none__' || normalized === 'null' || normalized === 'none') {
    return { bare: true, ids: [] };
  }

  const folderId = raw.trim();
  const recursive = url.searchParams.get('recursive') !== '0';

  // 先确认目标 folder 存在，避免悬空 id 让前端误以为「该目录下没图」。
  const exists = await db.prepare('SELECT id FROM folders WHERE id = ?').bind(folderId).first<{ id: string }>();
  if (!exists) return 'invalid';

  if (!recursive) return { bare: false, ids: [folderId] };

  const descendants = await collectDescendantIds(db, folderId);
  return { bare: false, ids: [...descendants] };
};

interface ListImagesOptions {
  admin: boolean;
  logPath: string;
}

export const handleListImages = async (
  env: Env,
  request: Request,
  options: ListImagesOptions,
): Promise<Response> => {
  try {
    const search = normalizeSearch(request);
    const pagination = parsePagination(request);
    if (pagination === 'invalid') return badRequest('invalid_pagination');

    const folderFilter = await parseFolderParam(request, env.DB);
    if (folderFilter === 'invalid') {
      // 文件夹不存在时直接返回空列表，跟前端期望一致（不抛错）。
      return json(pagination ? { items: [], nextCursor: null } : []);
    }

    const conditions: string[] = [];
    const binds: unknown[] = [];

    if (!options.admin) conditions.push('is_public = 1');

    if (search) {
      const likeBinds = Array(7).fill(`%${search}%`);
      if (options.admin) {
        conditions.push(
          '(title LIKE ? OR caption LIKE ? OR original_filename LIKE ? OR location_name LIKE ? OR search_content LIKE ? OR dominant_color LIKE ? OR composition LIKE ?)',
        );
      } else {
        conditions.push(
          '(title LIKE ? OR caption LIKE ? OR original_filename LIKE ? OR (location_public = 1 AND location_name LIKE ?) OR search_content LIKE ? OR dominant_color LIKE ? OR composition LIKE ?)',
        );
      }
      binds.push(...likeBinds);
    }

    if (folderFilter) {
      if (folderFilter.bare) {
        conditions.push('folder_id IS NULL');
      } else if (folderFilter.ids.length > 0) {
        const placeholders = folderFilter.ids.map(() => '?').join(',');
        conditions.push(`folder_id IN (${placeholders})`);
        binds.push(...folderFilter.ids);
      }
    }

    if (pagination?.cursor) {
      conditions.push('(created_at < ? OR (created_at = ? AND key < ?))');
      binds.push(pagination.cursor.createdAt, pagination.cursor.createdAt, pagination.cursor.key);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = pagination
      ? `SELECT ${IMAGE_SELECT_COLUMNS} FROM images ${whereClause} ORDER BY created_at DESC, key DESC LIMIT ?`
      : `SELECT ${IMAGE_SELECT_COLUMNS} FROM images ${whereClause} ORDER BY created_at DESC`;
    const queryBinds = pagination ? [...binds, pagination.limit + 1] : binds;

    const result = await env.DB.prepare(sql).bind(...queryBinds).all<ImageRow>();
    const rows = result.results ?? [];
    const pageRows = pagination ? rows.slice(0, pagination.limit) : rows;
    const records = pageRows.map((row) =>
      options.admin
        ? rowToAdminRecord(row)
        : scrubRecordForVisitor(rowToRecord(row, env.PUBLIC_BASE_URL)),
    );

    if (!pagination) return json(records);

    return json({
      items: records,
      nextCursor:
        rows.length > pagination.limit && pageRows.length > 0
          ? encodeCursor(pageRows[pageRows.length - 1])
          : null,
    });
  } catch (error) {
    console.error(`GET ${options.logPath} failed`, error);
    return serverError('list_failed');
  }
};
