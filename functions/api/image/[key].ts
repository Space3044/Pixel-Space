import type { Env } from '../../types';
import { json, notFound, serverError } from '../../_shared/http';
import type { ImageRow } from '../../_shared/images';
import { rowToRecord } from '../../_shared/images';

const DETAIL_SQL =
  'SELECT key, title, caption, r2_key, width, height, format, bytes_compressed, location_name, location_lat, location_lng, exif_taken_at, exif_camera, exif_iso, exif_aperture, exif_shutter, exif_focal_length FROM images WHERE key = ?';

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const key = String(params.key ?? '');
  if (!key) return notFound();
  try {
    const row = await env.DB.prepare(DETAIL_SQL).bind(key).first<ImageRow>();
    if (!row) return notFound();
    return json(rowToRecord(row, env.PUBLIC_BASE_URL));
  } catch (error) {
    console.error(`GET /api/image/${key} failed`, error);
    return serverError('image_failed');
  }
};
