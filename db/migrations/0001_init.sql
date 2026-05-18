-- 0001_init.sql
-- 阶段 3：MVP 列表 / 详情 / 上传链路所需的最小字段。
-- AI 字段（caption/tags_json/search_content/ocr_text/ai_*）等到阶段 10 再 ALTER TABLE ADD COLUMN。
-- Telegram 字段（tg_file_id/tg_message_id/tg_chat_id）等到阶段 9 再加。
-- 位置只接受管理员手动填写的 location_lat / location_lng，不从 EXIF GPS 提取。

CREATE TABLE images (
  key              TEXT    PRIMARY KEY NOT NULL,
  title            TEXT    NOT NULL DEFAULT '',
  caption          TEXT,
  r2_key           TEXT    NOT NULL,
  width            INTEGER NOT NULL,
  height           INTEGER NOT NULL,
  format           TEXT    NOT NULL,
  bytes_compressed INTEGER NOT NULL,
  bytes_original   INTEGER NOT NULL,
  hash             TEXT    NOT NULL,
  location_name    TEXT,
  location_lat     REAL,
  location_lng     REAL,
  exif_taken_at    TEXT,
  exif_camera      TEXT,
  exif_iso         INTEGER,
  exif_aperture    REAL,
  exif_shutter     TEXT,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_images_created_at ON images (created_at DESC);
