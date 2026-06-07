import type { Env } from '../types';
import { archiveOriginalToTelegram } from './telegram';
import type { RequestLogger } from './logger';

const UPDATE_TG_PENDING_SQL = `
UPDATE images
SET tg_file_id = NULL,
    tg_message_id = NULL,
    tg_chat_id = NULL,
    tg_status = 'pending',
    tg_error = NULL,
    updated_at = datetime('now')
WHERE key = ?
`;

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

const errorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) return error.message.slice(0, 300);
  return 'telegram_archive_failed';
};

export const markTelegramArchivePending = async (env: Env, key: string): Promise<void> => {
  await env.DB.prepare(UPDATE_TG_PENDING_SQL).bind(key).run();
};

export const archiveOriginalAfterUpload = async (
  env: Env,
  original: File,
  key: string,
  logger?: RequestLogger,
): Promise<void> => {
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
    logger?.error('Telegram original archive failed', {
      error: archiveError,
      context: { key },
    });
    await env.DB.prepare(UPDATE_TG_FAILED_SQL).bind(errorMessage(archiveError), key).run();
  }
};
