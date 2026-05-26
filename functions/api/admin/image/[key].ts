import type { Env } from '../../../types';
import { badRequest, json, notFound, serverError, unauthorized } from '../../../_shared/http';
import { resolveAdmin } from '../../../_shared/auth';
import type { ImageRow } from '../../../_shared/images';
import { IMAGE_SELECT_COLUMNS, normalizeColorPaletteJson, normalizeTagsJson, rowToRecord } from '../../../_shared/images';
import { deleteTelegramMessage } from '../../../_shared/telegram';

const DETAIL_SQL = `
SELECT ${IMAGE_SELECT_COLUMNS}
FROM images
WHERE key = ?
`;

const DELETE_DETAIL_SQL = `
SELECT key, tg_chat_id, tg_message_id
FROM images
WHERE key = ?
`;

const UPDATE_SQL = `
UPDATE images
SET title = ?,
    caption = ?,
    location_name = ?,
    location_lat = ?,
    location_lng = ?,
    tags_json = ?,
    dominant_color = ?,
    color_palette_json = ?,
    composition = ?,
    is_public = COALESCE(?, is_public),
    location_public = COALESCE(?, location_public),
    updated_at = datetime('now')
WHERE key = ?
`;

const DELETE_SQL = 'DELETE FROM images WHERE key = ?';

interface DeleteRow {
  key: string;
  tg_chat_id: string | null;
  tg_message_id: number | null;
}

interface EditablePayload {
  title: string;
  caption: string | null;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  tags_json: string | null;
  dominant_color: string | null;
  color_palette_json: string | null;
  composition: string | null;
  is_public: 0 | 1 | null;
  location_public: 0 | 1 | null;
}

const stringOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const stringOrEmpty = (value: unknown): string => stringOrNull(value) ?? '';

const coordinateOrNull = (value: unknown, min: number, max: number): number | null | undefined => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return undefined;
  return value;
};

// 缺失字段 -> null（让 SQL COALESCE 保持原值）。
// 提供布尔/0/1/'0'/'1' -> 规范化为 0 | 1。其它值视为无效，返回 undefined 以触发 400。
const flagOrPreserve = (value: unknown): 0 | 1 | null | undefined => {
  if (value === undefined) return null;
  if (value === true || value === 1 || value === '1') return 1;
  if (value === false || value === 0 || value === '0') return 0;
  return undefined;
};

const payloadFromRequest = async (request: Request): Promise<EditablePayload | null> => {
  let raw: Record<string, unknown>;
  try {
    const data = (await request.json()) as unknown;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    raw = data as Record<string, unknown>;
  } catch {
    return null;
  }

  const locationLat = coordinateOrNull(raw.location_lat, -90, 90);
  const locationLng = coordinateOrNull(raw.location_lng, -180, 180);
  if (locationLat === undefined || locationLng === undefined) return null;

  const isPublic = flagOrPreserve(raw.is_public);
  const locationPublic = flagOrPreserve(raw.location_public);
  if (isPublic === undefined || locationPublic === undefined) return null;

  return {
    title: stringOrEmpty(raw.title),
    caption: stringOrNull(raw.caption),
    location_name: stringOrNull(raw.location_name),
    location_lat: locationLat,
    location_lng: locationLng,
    tags_json: normalizeTagsJson(raw.tags),
    dominant_color: stringOrNull(raw.dominant_color),
    color_palette_json: normalizeColorPaletteJson(raw.palette),
    composition: stringOrNull(raw.composition),
    is_public: isPublic,
    location_public: locationPublic,
  };
};

const keyFromParams = (params: EventContext<Env, string, unknown>['params']): string => String(params.key ?? '');

export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  if (!resolveAdmin(request, env)) return unauthorized();

  const key = keyFromParams(params);
  if (!key) return notFound();

  const payload = await payloadFromRequest(request);
  if (!payload) return badRequest('invalid_image_payload');

  try {
    await env.DB.prepare(UPDATE_SQL)
      .bind(
        payload.title,
        payload.caption,
        payload.location_name,
        payload.location_lat,
        payload.location_lng,
        payload.tags_json,
        payload.dominant_color,
        payload.color_palette_json,
        payload.composition,
        payload.is_public,
        payload.location_public,
        key,
      )
      .run();

    const row = await env.DB.prepare(DETAIL_SQL).bind(key).first<ImageRow>();
    if (!row) return notFound();
    return json(rowToRecord(row, env.PUBLIC_BASE_URL));
  } catch (error) {
    console.error(`PATCH /api/admin/image/${key} failed`, error);
    return serverError('image_update_failed');
  }
};

export const onRequestDelete: PagesFunction<Env> = async ({ env, params, request }) => {
  if (!resolveAdmin(request, env)) return unauthorized();

  const key = keyFromParams(params);
  if (!key) return notFound();

  try {
    const row = await env.DB.prepare(DELETE_DETAIL_SQL).bind(key).first<DeleteRow>();
    if (!row) return notFound();

    await env.BUCKET.delete(row.key);

    if (row.tg_chat_id && row.tg_message_id) {
      try {
        await deleteTelegramMessage({
          token: env.TG_BOT_TOKEN,
          chatId: row.tg_chat_id,
          messageId: row.tg_message_id,
        });
      } catch (error) {
        console.error(`Telegram message cleanup failed for ${key}`, error);
      }
    }

    await env.DB.prepare(DELETE_SQL).bind(key).run();
    return json({ ok: true, key });
  } catch (error) {
    console.error(`DELETE /api/admin/image/${key} failed`, error);
    return serverError('image_delete_failed');
  }
};
