import type { Env } from '../../types';
import { json, notFound, serverError } from '../../_shared/http';
import { resolveAdmin } from '../../_shared/auth';
import type { ImageRow } from '../../_shared/images';
import { IMAGE_SELECT_COLUMNS, rowToRecord, scrubRecordForVisitor } from '../../_shared/images';

// 单图详情：保留"凭直链访问私图"的能力（is_public 不参与过滤），
// 管理员视角返回全量；访客视角对 location_public=0 的图擦掉地名与坐标。
const DETAIL_SQL =
  `SELECT ${IMAGE_SELECT_COLUMNS} FROM images WHERE key = ?`;

export const onRequestGet: PagesFunction<Env> = async ({ env, params, request }) => {
  const key = String(params.key ?? '');
  if (!key) return notFound();
  try {
    const row = await env.DB.prepare(DETAIL_SQL).bind(key).first<ImageRow>();
    if (!row) return notFound();
    const isAdmin = resolveAdmin(request, env) !== null;
    const record = rowToRecord(row, env.PUBLIC_BASE_URL);
    return json(isAdmin ? record : scrubRecordForVisitor(record));
  } catch (error) {
    console.error(`GET /api/image/${key} failed`, error);
    return serverError('image_failed');
  }
};
