import type { Env } from '../types';
import { json, serverError } from '../_shared/http';
import { resolveAdmin } from '../_shared/auth';
import type { ImageRow } from '../_shared/images';
import { rowToRecord, scrubRecordForVisitor } from '../_shared/images';

// 访客视角：仅返回 is_public=1 的图，且对 location_public=0 的图擦掉位置字段。
// 管理员视角：返回全量数据，不过滤、不擦字段。
const LIST_ADMIN_SQL =
  'SELECT key, title, caption, r2_key, original_filename, width, height, format, bytes_compressed, location_name, location_lat, location_lng, exif_taken_at, exif_camera, exif_iso, exif_aperture, exif_shutter, exif_focal_length, tags_json, dominant_color, color_palette_json, composition, ai_status, ai_error, ai_attempts, ai_finished_at, is_public, location_public FROM images ORDER BY created_at DESC';

const LIST_VISITOR_SQL =
  "SELECT key, title, caption, r2_key, original_filename, width, height, format, bytes_compressed, location_name, location_lat, location_lng, exif_taken_at, exif_camera, exif_iso, exif_aperture, exif_shutter, exif_focal_length, tags_json, dominant_color, color_palette_json, composition, ai_status, ai_error, ai_attempts, ai_finished_at, is_public, location_public FROM images WHERE is_public = 1 ORDER BY created_at DESC";

const SEARCH_ADMIN_SQL = `
SELECT key, title, caption, r2_key, original_filename, width, height, format, bytes_compressed, location_name, location_lat, location_lng, exif_taken_at, exif_camera, exif_iso, exif_aperture, exif_shutter, exif_focal_length, tags_json, dominant_color, color_palette_json, composition, ai_status, ai_error, ai_attempts, ai_finished_at, is_public, location_public
FROM images
WHERE title LIKE ? OR caption LIKE ? OR location_name LIKE ? OR search_content LIKE ? OR dominant_color LIKE ? OR composition LIKE ?
ORDER BY created_at DESC
`;

const SEARCH_VISITOR_SQL = `
SELECT key, title, caption, r2_key, original_filename, width, height, format, bytes_compressed, location_name, location_lat, location_lng, exif_taken_at, exif_camera, exif_iso, exif_aperture, exif_shutter, exif_focal_length, tags_json, dominant_color, color_palette_json, composition, ai_status, ai_error, ai_attempts, ai_finished_at, is_public, location_public
FROM images
WHERE is_public = 1
  AND (
    title LIKE ?
    OR caption LIKE ?
    OR (location_public = 1 AND location_name LIKE ?)
    OR search_content LIKE ?
    OR dominant_color LIKE ?
    OR composition LIKE ?
  )
ORDER BY created_at DESC
`;

const normalizeSearch = (request: Request): string => {
  const value = new URL(request.url).searchParams.get('q') ?? '';
  return value.trim().slice(0, 100);
};

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const isAdmin = resolveAdmin(request, env) !== null;
    const query = normalizeSearch(request);
    const sql = query
      ? isAdmin
        ? SEARCH_ADMIN_SQL
        : SEARCH_VISITOR_SQL
      : isAdmin
        ? LIST_ADMIN_SQL
        : LIST_VISITOR_SQL;
    const statement = env.DB.prepare(sql);
    const result = query
      ? await statement
          .bind(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`)
          .all<ImageRow>()
      : await statement.all<ImageRow>();
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
