import type { Env } from '../types';
import { badRequest, json, notFound, serverError, unauthorized } from '../_shared/http';
import { resolveAdmin } from '../_shared/auth';
import type { ImageRow } from '../_shared/images';
import { rowToRecord } from '../_shared/images';

const SELECT_BY_HASH_SQL =
  'SELECT key, title, caption, r2_key, original_filename, width, height, format, bytes_compressed, location_name, location_lat, location_lng, exif_taken_at, exif_camera, exif_iso, exif_aperture, exif_shutter, exif_focal_length, tags_json, dominant_color, color_palette_json, composition, ai_status, ai_error, ai_attempts, ai_finished_at, is_public, location_public, folder_id FROM images WHERE hash = ? LIMIT 1';

const HASH_PATTERN = /^[0-9a-f]{64}$/;

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  if (!resolveAdmin(request, env)) return unauthorized();

  const hash = (new URL(request.url).searchParams.get('hash') ?? '').trim().toLowerCase();
  if (!HASH_PATTERN.test(hash)) return badRequest('invalid_hash');

  try {
    const row = await env.DB.prepare(SELECT_BY_HASH_SQL).bind(hash).first<ImageRow>();
    if (!row) return notFound('hash_not_found');
    return json(rowToRecord(row, env.PUBLIC_BASE_URL));
  } catch (error) {
    console.error('GET /api/check-hash failed', error);
    return serverError('check_hash_failed');
  }
};
