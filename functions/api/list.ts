import type { Env } from '../types';
import { json, serverError } from '../_shared/http';
import type { ImageRow } from '../_shared/images';
import { rowToRecord } from '../_shared/images';

const LIST_SQL =
  'SELECT key, title, caption, r2_key, original_filename, width, height, format, bytes_compressed, location_name, location_lat, location_lng, exif_taken_at, exif_camera, exif_iso, exif_aperture, exif_shutter, exif_focal_length, tags_json, ai_status, ai_error, ai_attempts, ai_finished_at FROM images ORDER BY created_at DESC';

const SEARCH_SQL = `
SELECT key, title, caption, r2_key, original_filename, width, height, format, bytes_compressed, location_name, location_lat, location_lng, exif_taken_at, exif_camera, exif_iso, exif_aperture, exif_shutter, exif_focal_length, tags_json, ai_status, ai_error, ai_attempts, ai_finished_at
FROM images
WHERE title LIKE ? OR caption LIKE ? OR location_name LIKE ? OR search_content LIKE ?
ORDER BY created_at DESC
`;

const normalizeSearch = (request: Request): string => {
  const value = new URL(request.url).searchParams.get('q') ?? '';
  return value.trim().slice(0, 100);
};

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const query = normalizeSearch(request);
    const statement = env.DB.prepare(query ? SEARCH_SQL : LIST_SQL);
    const result = query
      ? await statement.bind(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`).all<ImageRow>()
      : await statement.all<ImageRow>();
    const records = (result.results ?? []).map((row) => rowToRecord(row, env.PUBLIC_BASE_URL));
    return json(records);
  } catch (error) {
    console.error('GET /api/list failed', error);
    return serverError('list_failed');
  }
};
