import type { Env } from '../types';
import { json, serverError } from '../_shared/http';
import { resolveAdmin } from '../_shared/auth';
import type { ImageRow } from '../_shared/images';
import { rowToRecord, scrubRecordForVisitor } from '../_shared/images';

// 首页站点统计：默认按公开聚合视角，访客与管理员看到一致的对外口径。
// photos: 公开图片总数
// storage_bytes: 公开图片压缩后总字节
// ai_tagged: AI 已成功标注（ai_status = 'ok'）的公开图片数
// places: 标注了 location_name 且 location_public=1 的去重地点数
// latest: 最近 6 张公开图，作为首页的视觉钩子
const SUMMARY_SQL = `
SELECT
  COUNT(*) AS photos,
  COALESCE(SUM(bytes_compressed), 0) AS storage_bytes,
  COALESCE(SUM(CASE WHEN ai_status = 'ok' THEN 1 ELSE 0 END), 0) AS ai_tagged,
  COALESCE(COUNT(DISTINCT CASE WHEN location_name IS NOT NULL AND location_public = 1 THEN location_name END), 0) AS places
FROM images
WHERE is_public = 1
`;

const LATEST_SQL = `
SELECT key, title, caption, r2_key, original_filename, width, height, format, bytes_compressed, location_name, location_lat, location_lng, exif_taken_at, exif_camera, exif_iso, exif_aperture, exif_shutter, exif_focal_length, tags_json, dominant_color, color_palette_json, composition, ai_status, ai_error, ai_attempts, ai_finished_at, is_public, location_public
FROM images
WHERE is_public = 1
ORDER BY created_at DESC
LIMIT 6
`;

interface SummaryRow {
  photos: number;
  storage_bytes: number;
  ai_tagged: number;
  places: number;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const isAdmin = resolveAdmin(request, env) !== null;
    const [summary, latest] = await Promise.all([
      env.DB.prepare(SUMMARY_SQL).first<SummaryRow>(),
      env.DB.prepare(LATEST_SQL).all<ImageRow>(),
    ]);

    const latestRecords = (latest.results ?? []).map((row) => {
      const record = rowToRecord(row, env.PUBLIC_BASE_URL);
      return isAdmin ? record : scrubRecordForVisitor(record);
    });

    return json({
      photos: summary?.photos ?? 0,
      storage_bytes: summary?.storage_bytes ?? 0,
      ai_tagged: summary?.ai_tagged ?? 0,
      places: summary?.places ?? 0,
      latest: latestRecords,
    });
  } catch (error) {
    console.error('GET /api/stats failed', error);
    return serverError('stats_failed');
  }
};
