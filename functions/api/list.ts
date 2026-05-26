import type { Env } from '../types';
import { json, serverError } from '../_shared/http';
import { resolveAdmin } from '../_shared/auth';
import { collectDescendantIds } from '../_shared/folders';
import type { ImageRow } from '../_shared/images';
import { IMAGE_SELECT_COLUMNS, rowToRecord, scrubRecordForVisitor } from '../_shared/images';

// 列表与搜索共用一套动态拼接的 SQL：根据 isAdmin / 是否带搜索 / 是否带 folder 参数决定 WHERE。
// 访客视角强制 is_public=1，并把 location_name 搜索包在 location_public=1 守卫里。

const normalizeSearch = (request: Request): string => {
  const value = new URL(request.url).searchParams.get('q') ?? '';
  return value.trim().slice(0, 100);
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

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const isAdmin = resolveAdmin(request, env) !== null;
    const search = normalizeSearch(request);

    const folderFilter = await parseFolderParam(request, env.DB);
    if (folderFilter === 'invalid') {
      // 文件夹不存在时直接返回空列表，跟前端期望一致（不抛错）。
      return json([]);
    }

    const conditions: string[] = [];
    const binds: unknown[] = [];

    if (!isAdmin) conditions.push('is_public = 1');

    if (search) {
      const likeBinds = Array(6).fill(`%${search}%`);
      if (isAdmin) {
        conditions.push(
          '(title LIKE ? OR caption LIKE ? OR location_name LIKE ? OR search_content LIKE ? OR dominant_color LIKE ? OR composition LIKE ?)',
        );
      } else {
        conditions.push(
          '(title LIKE ? OR caption LIKE ? OR (location_public = 1 AND location_name LIKE ?) OR search_content LIKE ? OR dominant_color LIKE ? OR composition LIKE ?)',
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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT ${IMAGE_SELECT_COLUMNS} FROM images ${whereClause} ORDER BY created_at DESC`;

    const result = await env.DB.prepare(sql).bind(...binds).all<ImageRow>();
    const records = (result.results ?? []).map((row) => {
      const record = rowToRecord(row, env.PUBLIC_BASE_URL);
      return isAdmin ? record : scrubRecordForVisitor(record);
    });
    return json(records);
  } catch (error) {
    console.error('GET /api/list failed', error);
    return serverError('list_failed');
  }
};
