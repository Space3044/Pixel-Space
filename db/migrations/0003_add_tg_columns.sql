-- 0003_add_tg_columns.sql
-- 阶段 9：把原图归档到 Telegram 私有频道，D1 只保存可取回原图所需的最小状态。

ALTER TABLE images ADD COLUMN tg_file_id TEXT;
ALTER TABLE images ADD COLUMN tg_message_id INTEGER;
ALTER TABLE images ADD COLUMN tg_chat_id TEXT;
ALTER TABLE images ADD COLUMN tg_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE images ADD COLUMN tg_error TEXT;
