-- 0010_prune_image_columns.sql
-- 收紧 images 表：R2 对象 key 统一使用主键 key；移除未使用的原图大小、OCR 和 AI 重试跟踪列。
-- SQLite/D1 没有可靠的 DROP COLUMN IF EXISTS；这里重建表，可以兼容本地历史库里残留的 ocr_text / ai_proxy_url / ai_model。

PRAGMA foreign_keys = off;

CREATE TABLE images_next (
  key                TEXT    PRIMARY KEY NOT NULL,
  title              TEXT    NOT NULL DEFAULT '',
  caption            TEXT,
  original_filename  TEXT    NOT NULL DEFAULT '',
  width              INTEGER NOT NULL,
  height             INTEGER NOT NULL,
  format             TEXT    NOT NULL,
  bytes_compressed   INTEGER NOT NULL,
  hash               TEXT    NOT NULL,
  location_name      TEXT,
  location_lat       REAL,
  location_lng       REAL,
  exif_taken_at      TEXT,
  exif_camera        TEXT,
  exif_iso           INTEGER,
  exif_aperture      REAL,
  exif_shutter       TEXT,
  exif_focal_length  REAL,
  tg_file_id         TEXT,
  tg_message_id      INTEGER,
  tg_chat_id         TEXT,
  tg_status          TEXT    NOT NULL DEFAULT 'pending',
  tg_error           TEXT,
  tags_json          TEXT,
  search_content     TEXT,
  ai_status          TEXT    NOT NULL DEFAULT 'pending',
  created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  dominant_color     TEXT,
  color_palette_json TEXT,
  composition        TEXT,
  is_public          INTEGER NOT NULL DEFAULT 1,
  location_public    INTEGER NOT NULL DEFAULT 1,
  folder_id          TEXT REFERENCES folders(id)
);

INSERT INTO images_next (
  key,
  title,
  caption,
  original_filename,
  width,
  height,
  format,
  bytes_compressed,
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
  tg_file_id,
  tg_message_id,
  tg_chat_id,
  tg_status,
  tg_error,
  tags_json,
  search_content,
  ai_status,
  created_at,
  updated_at,
  dominant_color,
  color_palette_json,
  composition,
  is_public,
  location_public,
  folder_id
)
SELECT
  key,
  title,
  caption,
  original_filename,
  width,
  height,
  format,
  bytes_compressed,
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
  tg_file_id,
  tg_message_id,
  tg_chat_id,
  tg_status,
  tg_error,
  tags_json,
  search_content,
  ai_status,
  created_at,
  updated_at,
  dominant_color,
  color_palette_json,
  composition,
  is_public,
  location_public,
  folder_id
FROM images;

DROP TABLE images;
ALTER TABLE images_next RENAME TO images;

CREATE INDEX idx_images_created_at ON images (created_at DESC);
CREATE INDEX idx_images_hash ON images (hash);
CREATE INDEX idx_images_is_public_created_at ON images (is_public, created_at DESC);
CREATE INDEX idx_images_folder_id ON images (folder_id);

PRAGMA foreign_key_check;
PRAGMA foreign_keys = on;
