import type { Env } from '../../../types';
import { badRequest, json, notFound, serverError, unauthorized } from '../../../_shared/http';
import { resolveAdmin } from '../../../_shared/auth';
import { withRequestLogging } from '../../../_shared/logger';
import type { ImageRow } from '../../../_shared/images';
import { IMAGE_SELECT_COLUMNS, normalizeColorPaletteJson, normalizeRegion, normalizeTagsJson, rowToAdminRecord } from '../../../_shared/images';
import {
  optionalCoordinate,
  optionalFlag,
  parseJsonObject,
  stringOrEmpty,
  stringOrNull,
} from '../../../_shared/request';
import { deleteTelegramMessage } from '../../../_shared/telegram';
import { keyFromRouteParam } from '../../../_shared/keys';
import { requireSameOrigin } from '../../../_shared/security';
import { createStaticMapCacheTask, deleteUnusedStaticMapCache, staticMapRefererFromRequest } from '../../../_shared/static-map';

const DETAIL_SQL = `
SELECT ${IMAGE_SELECT_COLUMNS}
FROM images
WHERE key = ?
`;

const DELETE_DETAIL_SQL = `
SELECT key, tg_chat_id, tg_message_id, location_lat, location_lng, location_region
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
    location_region = ?,
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
  location_lat: number | null;
  location_lng: number | null;
  location_region: 'china' | 'global' | null;
}

interface StaticMapReferenceLike {
  location_lat: number | null;
  location_lng: number | null;
  location_region: 'china' | 'global' | null;
}

interface EditablePayload {
  title: string;
  caption: string | null;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_region: 'china' | 'global' | null;
  tags_json: string | null;
  dominant_color: string | null;
  color_palette_json: string | null;
  composition: string | null;
  is_public: 0 | 1 | null;
  location_public: 0 | 1 | null;
}

const payloadFromRequest = async (request: Request): Promise<EditablePayload | null> => {
  const raw = await parseJsonObject(request);
  if (!raw) return null;

  const locationLat = optionalCoordinate(raw.location_lat, -90, 90);
  const locationLng = optionalCoordinate(raw.location_lng, -180, 180);
  if (locationLat === undefined || locationLng === undefined) return null;

  const isPublic = optionalFlag(raw.is_public);
  const locationPublic = optionalFlag(raw.location_public);
  if (isPublic === undefined || locationPublic === undefined) return null;

  return {
    title: stringOrEmpty(raw.title),
    caption: stringOrNull(raw.caption),
    location_name: stringOrNull(raw.location_name),
    location_lat: locationLat,
    location_lng: locationLng,
    location_region: normalizeRegion(raw.location_region, locationLat, locationLng),
    tags_json: normalizeTagsJson(raw.tags),
    dominant_color: stringOrNull(raw.dominant_color),
    color_palette_json: normalizeColorPaletteJson(raw.palette),
    composition: stringOrNull(raw.composition),
    is_public: isPublic,
    location_public: locationPublic,
  };
};

const keyFromParams = (params: EventContext<Env, string, unknown>['params']): string =>
  keyFromRouteParam(params.key);

const staticMapReferenceKey = (row: StaticMapReferenceLike): string | null => {
  if (row.location_lat === null || row.location_lng === null || !row.location_region) return null;
  if (!Number.isFinite(row.location_lat) || !Number.isFinite(row.location_lng)) return null;
  return `${row.location_region}:${row.location_lat.toFixed(6)}:${row.location_lng.toFixed(6)}`;
};

const staticMapReferenceChanged = (before: StaticMapReferenceLike, after: StaticMapReferenceLike): boolean =>
  staticMapReferenceKey(before) !== staticMapReferenceKey(after);

export const onRequestGet: PagesFunction<Env> = withRequestLogging('/api/admin/image/:key', async ({ env, params, request }, logger) => {
  if (!(await resolveAdmin(request, env))) return unauthorized();

  const key = keyFromParams(params);
  if (!key) return notFound();

  try {
    const row = await env.DB.prepare(DETAIL_SQL).bind(key).first<ImageRow>();
    if (!row) return notFound();
    return json(rowToAdminRecord(row));
  } catch (error) {
    logger.error('GET /api/admin/image/:key failed', {
      error,
      context: { key },
    });
    return serverError('image_failed');
  }
});

export const onRequestPatch: PagesFunction<Env> = withRequestLogging('/api/admin/image/:key', async (context, logger) => {
  const { request, env, params } = context;
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  if (!(await resolveAdmin(request, env))) return unauthorized();

  const key = keyFromParams(params);
  if (!key) return notFound();

  const payload = await payloadFromRequest(request);
  if (!payload) return badRequest('invalid_image_payload');

  try {
    const previousRow = await env.DB.prepare(DELETE_DETAIL_SQL).bind(key).first<DeleteRow>();
    if (!previousRow) return notFound();

    await env.DB.prepare(UPDATE_SQL)
      .bind(
        payload.title,
        payload.caption,
        payload.location_name,
        payload.location_lat,
        payload.location_lng,
        payload.location_region,
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

    if (staticMapReferenceChanged(previousRow, row)) {
      try {
        await deleteUnusedStaticMapCache(env, previousRow);
      } catch (error) {
        logger.error('Static map cleanup failed', {
          error,
          context: { key },
        });
      }
    }

    const staticMapTask = createStaticMapCacheTask(
      env,
      row.location_lat,
      row.location_lng,
      row.location_region,
      logger,
      staticMapRefererFromRequest(request),
    );
    if (staticMapTask) {
      if (typeof context.waitUntil === 'function') {
        context.waitUntil(staticMapTask);
      } else {
        await staticMapTask;
      }
    }
    return json(rowToAdminRecord(row));
  } catch (error) {
    logger.error('PATCH /api/admin/image/:key failed', {
      error,
      context: { key },
    });
    return serverError('image_update_failed');
  }
});

export const onRequestDelete: PagesFunction<Env> = withRequestLogging('/api/admin/image/:key', async ({ env, params, request }, logger) => {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  if (!(await resolveAdmin(request, env))) return unauthorized();

  const key = keyFromParams(params);
  if (!key) return notFound();

  try {
    const row = await env.DB.prepare(DELETE_DETAIL_SQL).bind(key).first<DeleteRow>();
    if (!row) return notFound();

    await deleteUnusedStaticMapCache(env, row);
    await env.BUCKET.delete(row.key);

    if (row.tg_chat_id && row.tg_message_id) {
      try {
        await deleteTelegramMessage({
          token: env.TG_BOT_TOKEN,
          chatId: row.tg_chat_id,
          messageId: row.tg_message_id,
        });
      } catch (error) {
        logger.error('Telegram message cleanup failed', {
          error,
          context: { key },
        });
      }
    }

    await env.DB.prepare(DELETE_SQL).bind(key).run();
    return json({ ok: true, key });
  } catch (error) {
    logger.error('DELETE /api/admin/image/:key failed', {
      error,
      context: { key },
    });
    return serverError('image_delete_failed');
  }
});
