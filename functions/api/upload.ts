import type { Env } from '../types';
import { badRequest, json, serverError, unauthorized } from '../_shared/http';
import { resolveAdmin } from '../_shared/auth';
import type { ImageRow } from '../_shared/images';
import { normalizeColorPaletteJson, normalizeTagsJson, rowToRecord } from '../_shared/images';
import { archiveOriginalToTelegram } from '../_shared/telegram';

const MAX_ORIGINAL_BYTES = 50 * 1024 * 1024;

const INSERT_SQL = `
INSERT INTO images (
  key,
  title,
  caption,
  r2_key,
  original_filename,
  width,
  height,
  format,
  bytes_compressed,
  bytes_original,
  hash,
  location_name,
  location_lat,
  location_lng,
  exif_taken_at,
  exif_camera,
  exif_iso,
  exif_aperture,
  exif_shutter,
  exif_focal_length,
  tags_json,
  search_content,
  dominant_color,
  color_palette_json,
  composition,
  ai_status,
  tg_status,
  is_public,
  location_public,
  folder_id
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const SELECT_SQL =
  'SELECT key, title, caption, r2_key, original_filename, width, height, format, bytes_compressed, location_name, location_lat, location_lng, exif_taken_at, exif_camera, exif_iso, exif_aperture, exif_shutter, exif_focal_length, tags_json, dominant_color, color_palette_json, composition, ai_status, ai_error, ai_attempts, ai_finished_at, is_public, location_public, folder_id FROM images WHERE key = ?';

const SELECT_BY_HASH_SQL =
  'SELECT key, title, caption, r2_key, original_filename, width, height, format, bytes_compressed, location_name, location_lat, location_lng, exif_taken_at, exif_camera, exif_iso, exif_aperture, exif_shutter, exif_focal_length, tags_json, dominant_color, color_palette_json, composition, ai_status, ai_error, ai_attempts, ai_finished_at, is_public, location_public, folder_id FROM images WHERE hash = ? LIMIT 1';

const UPDATE_TG_DONE_SQL = `
UPDATE images
SET tg_file_id = ?,
    tg_message_id = ?,
    tg_chat_id = ?,
    tg_status = 'done',
    tg_error = NULL,
    updated_at = datetime('now')
WHERE key = ?
`;

const UPDATE_TG_FAILED_SQL = `
UPDATE images
SET tg_status = 'failed',
    tg_error = ?,
    updated_at = datetime('now')
WHERE key = ?
`;

interface UploadMeta {
  title: string;
  caption: string | null;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  tags_json: string | null;
  search_content: string | null;
  dominant_color: string | null;
  color_palette_json: string | null;
  composition: string | null;
  ai_status: 'pending' | 'done' | 'failed';
  is_public: 0 | 1;
  location_public: 0 | 1;
  folder_id: string | null;
}

interface UploadExif {
  taken_at: string | null;
  camera: string | null;
  iso: number | null;
  aperture: number | null;
  shutter: string | null;
  focal_length: number | null;
}

interface UploadDimensions {
  width: number;
  height: number;
}

const fileFromForm = (formData: FormData, name: string): File | null => {
  const value = formData.get(name);
  return value && typeof value !== 'string' ? value : null;
};

const objectFromJsonField = (formData: FormData, name: string): Record<string, unknown> | null => {
  const value = formData.get(name);
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

const stringOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const stringOrEmpty = (value: unknown): string => stringOrNull(value) ?? '';

const numberOrNull = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
};

const integerOrNull = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(value);
};

const normalizeCoordinate = (value: unknown, min: number, max: number): number | null => {
  const number = numberOrNull(value);
  if (number === null || number < min || number > max) return null;
  return number;
};

const normalizeAiStatus = (value: unknown): UploadMeta['ai_status'] => {
  if (value === 'done' || value === 'failed' || value === 'pending') return value;
  return 'pending';
};

const normalizeFlag = (value: unknown, fallback: 0 | 1): 0 | 1 => {
  if (value === true || value === 1 || value === '1') return 1;
  if (value === false || value === 0 || value === '0') return 0;
  return fallback;
};

const normalizeMeta = (raw: Record<string, unknown>): UploadMeta => ({
  title: stringOrEmpty(raw.title),
  caption: stringOrNull(raw.caption),
  location_name: stringOrNull(raw.location_name),
  location_lat: normalizeCoordinate(raw.location_lat, -90, 90),
  location_lng: normalizeCoordinate(raw.location_lng, -180, 180),
  tags_json: normalizeTagsJson(raw.tags),
  search_content: stringOrNull(raw.search_content),
  dominant_color: stringOrNull(raw.dominant_color),
  color_palette_json: normalizeColorPaletteJson(raw.palette),
  composition: stringOrNull(raw.composition),
  ai_status: normalizeAiStatus(raw.ai_status),
  is_public: normalizeFlag(raw.is_public, 1),
  location_public: normalizeFlag(raw.location_public, 1),
  folder_id: stringOrNull(raw.folder_id),
});

const normalizeExif = (raw: Record<string, unknown>): UploadExif => ({
  taken_at: stringOrNull(raw.taken_at),
  camera: stringOrNull(raw.camera),
  iso: integerOrNull(raw.iso),
  aperture: numberOrNull(raw.aperture),
  shutter: stringOrNull(raw.shutter),
  focal_length: numberOrNull(raw.focal_length),
});

const normalizeDimensions = (raw: Record<string, unknown>): UploadDimensions | null => {
  const width = integerOrNull(raw.width);
  const height = integerOrNull(raw.height);
  if (width === null || height === null || width <= 0 || height <= 0) return null;
  return { width, height };
};

const sha256Hex = async (file: File): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const errorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) return error.message.slice(0, 300);
  return 'telegram_archive_failed';
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!resolveAdmin(request, env)) return unauthorized();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return badRequest('invalid_form_data');
  }

  const original = fileFromForm(formData, 'original');
  const compressed = fileFromForm(formData, 'compressed');
  const rawExif = objectFromJsonField(formData, 'exif');
  const rawMeta = objectFromJsonField(formData, 'meta');
  const rawDimensions = objectFromJsonField(formData, 'dimensions');

  if (!original || !compressed || !rawExif || !rawMeta || !rawDimensions) {
    return badRequest('missing_upload_fields');
  }
  if (!original.type.startsWith('image/')) return badRequest('invalid_original_mime');
  if (original.size > MAX_ORIGINAL_BYTES) return badRequest('original_too_large');
  if (compressed.type !== 'image/webp') return badRequest('invalid_compressed_mime');

  const dimensions = normalizeDimensions(rawDimensions);
  if (!dimensions) return badRequest('invalid_dimensions');

  const meta = normalizeMeta(rawMeta);
  const exif = normalizeExif(rawExif);
  const key = crypto.randomUUID();
  const r2Key = key;
  const originalFilename = original.name.trim() || key;
  const hash = await sha256Hex(original);

  if (meta.folder_id) {
    const folderRow = await env.DB
      .prepare('SELECT id FROM folders WHERE id = ?')
      .bind(meta.folder_id)
      .first<{ id: string }>();
    if (!folderRow) return badRequest('folder_not_found');
  }

  try {
    const existing = await env.DB.prepare(SELECT_BY_HASH_SQL).bind(hash).first<ImageRow>();
    if (existing) {
      return json(rowToRecord(existing, env.PUBLIC_BASE_URL), 200);
    }

    await env.BUCKET.put(r2Key, compressed, {
      httpMetadata: {
        contentType: compressed.type,
      },
    });

    await env.DB.prepare(INSERT_SQL)
      .bind(
        key,
        meta.title,
        meta.caption,
        r2Key,
        originalFilename,
        dimensions.width,
        dimensions.height,
        'webp',
        compressed.size,
        original.size,
        hash,
        meta.location_name,
        meta.location_lat,
        meta.location_lng,
        exif.taken_at,
        exif.camera,
        exif.iso,
        exif.aperture,
        exif.shutter,
        exif.focal_length,
        meta.tags_json,
        meta.search_content,
        meta.dominant_color,
        meta.color_palette_json,
        meta.composition,
        meta.ai_status,
        'pending',
        meta.is_public,
        meta.location_public,
        meta.folder_id,
      )
      .run();

    try {
      const archive = await archiveOriginalToTelegram({
        token: env.TG_BOT_TOKEN,
        chatId: env.TG_CHAT_ID,
        file: original,
        key,
      });
      await env.DB.prepare(UPDATE_TG_DONE_SQL)
        .bind(archive.file_id, archive.message_id, archive.chat_id, key)
        .run();
    } catch (archiveError) {
      console.error('Telegram original archive failed', archiveError);
      await env.DB.prepare(UPDATE_TG_FAILED_SQL).bind(errorMessage(archiveError), key).run();
    }

    const row = await env.DB.prepare(SELECT_SQL).bind(key).first<ImageRow>();
    if (!row) return serverError('upload_row_missing');

    return json(rowToRecord(row, env.PUBLIC_BASE_URL), 201);
  } catch (error) {
    console.error('POST /api/upload failed', error);
    return serverError('upload_failed');
  }
};
