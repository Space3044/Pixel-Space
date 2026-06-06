import type { Env } from '../../../types';
import { resolveAdmin } from '../../../_shared/auth';
import { badRequest, json, serverError, unauthorized } from '../../../_shared/http';
import { normalizeStringList, parseJsonObject } from '../../../_shared/request';
import { deleteTelegramMessage } from '../../../_shared/telegram';
import { requireSameOrigin } from '../../../_shared/security';

// 批量删除一组图片：清理 D1 行 + R2 对象 + Telegram 原图消息。
// 单次最多 200 张，超出请前端分片调用。

interface DeletePayload {
  keys: string[];
}

interface ImageRow {
  key: string;
  tg_chat_id: string | null;
  tg_message_id: number | null;
}

const MAX_BATCH = 200;

interface CleanupResult {
  key: string;
  r2Deleted: boolean;
}

const parsePayload = async (request: Request): Promise<DeletePayload | null> => {
  const raw = await parseJsonObject(request);
  if (!raw) return null;
  const keys = normalizeStringList(raw.keys, { min: 1, max: MAX_BATCH });
  if (!keys) return null;
  return { keys };
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const originError = requireSameOrigin(request);
  if (originError) return originError;
  if (!(await resolveAdmin(request, env))) return unauthorized();

  const payload = await parsePayload(request);
  if (!payload) return badRequest('invalid_delete_payload');

  try {
    const placeholders = payload.keys.map(() => '?').join(',');
    const rowsResult = await env.DB
      .prepare(`SELECT key, tg_chat_id, tg_message_id FROM images WHERE key IN (${placeholders})`)
      .bind(...payload.keys)
      .all<ImageRow>();

    const rows = rowsResult.results ?? [];
    if (rows.length === 0) {
      return json({ ok: true, deleted: 0, missing: payload.keys });
    }

    // R2 是图片公开访问的主副本。R2 删除失败时保留 D1 行，避免记录丢失后留下不可追踪对象。
    const cleanupResults: CleanupResult[] = await Promise.all(
      rows.map(async (row) => {
        try {
          await env.BUCKET.delete(row.key);
        } catch (error) {
          console.error(`R2 delete failed for ${row.key}`, error);
          return { key: row.key, r2Deleted: false };
        }
        if (row.tg_chat_id && row.tg_message_id) {
          try {
            await deleteTelegramMessage({
              token: env.TG_BOT_TOKEN,
              chatId: row.tg_chat_id,
              messageId: row.tg_message_id,
            });
          } catch (error) {
            console.error(`Telegram cleanup failed for ${row.key}`, error);
          }
        }
        return { key: row.key, r2Deleted: true };
      }),
    );

    const deletedKeys = cleanupResults.filter((result) => result.r2Deleted).map((result) => result.key);
    const failed = cleanupResults.filter((result) => !result.r2Deleted).map((result) => result.key);
    if (deletedKeys.length > 0) {
      const deletePlaceholders = deletedKeys.map(() => '?').join(',');
      await env.DB
        .prepare(`DELETE FROM images WHERE key IN (${deletePlaceholders})`)
        .bind(...deletedKeys)
        .run();
    }

    const foundSet = new Set(rows.map((r) => r.key));
    const missing = payload.keys.filter((k) => !foundSet.has(k));

    return json({ ok: failed.length === 0, deleted: deletedKeys.length, missing, failed });
  } catch (error) {
    console.error('POST /api/admin/images/delete failed', error);
    return serverError('images_delete_failed');
  }
};
