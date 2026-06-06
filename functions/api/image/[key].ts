import type { Env } from '../../types';
import { json, notFound, serverError } from '../../_shared/http';
import type { ImageRow } from '../../_shared/images';
import { IMAGE_SELECT_COLUMNS, rowToRecord, scrubRecordForVisitor } from '../../_shared/images';
import { keyFromRouteParam } from '../../_shared/keys';

// 单图详情公开入口：访客只能访问公开图，且对 location_public=0 的图擦掉地名与坐标。
const DETAIL_SQL =
  `SELECT ${IMAGE_SELECT_COLUMNS} FROM images WHERE key = ?`;

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const key = keyFromRouteParam(params.key);
  if (!key) return notFound();
  try {
    const row = await env.DB.prepare(DETAIL_SQL).bind(key).first<ImageRow>();
    if (!row) return notFound();
    if (row.is_public !== 1) return notFound();
    const record = rowToRecord(row, env.PUBLIC_BASE_URL);
    return json(scrubRecordForVisitor(record));
  } catch (error) {
    console.error(`GET /api/image/${key} failed`, error);
    return serverError('image_failed');
  }
};
