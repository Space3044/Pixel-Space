-- schema.sql
-- Fresh D1 schema for Pixel Space.
-- Paste this whole file into the Cloudflare D1 SQL console for an empty database.

CREATE TABLE folders (
  id         TEXT PRIMARY KEY NOT NULL,
  parent_id  TEXT,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (parent_id) REFERENCES folders(id)
);

CREATE UNIQUE INDEX idx_folders_parent_name ON folders (
  COALESCE(parent_id, ''),
  name
);

CREATE TABLE images (
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
  location_region    TEXT,
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

CREATE INDEX idx_images_created_at ON images (created_at DESC);
CREATE INDEX idx_images_hash ON images (hash);
CREATE INDEX idx_images_is_public_created_at ON images (is_public, created_at DESC);
CREATE INDEX idx_images_folder_id ON images (folder_id);

CREATE TABLE ai_settings (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  proxy_url  TEXT    NOT NULL DEFAULT '',
  model      TEXT    NOT NULL DEFAULT '',
  prompt     TEXT    NOT NULL DEFAULT '',
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE download_grants (
  id         TEXT PRIMARY KEY NOT NULL,
  code_hash  TEXT NOT NULL UNIQUE,
  code       TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_download_grants_expires_at ON download_grants (expires_at);
CREATE UNIQUE INDEX idx_download_grants_code ON download_grants (code);

CREATE TABLE download_grant_images (
  grant_id  TEXT NOT NULL,
  image_key TEXT NOT NULL,
  PRIMARY KEY (grant_id, image_key),
  FOREIGN KEY (grant_id) REFERENCES download_grants(id) ON DELETE CASCADE,
  FOREIGN KEY (image_key) REFERENCES images(key) ON DELETE CASCADE
);

CREATE INDEX idx_download_grant_images_image_key ON download_grant_images (image_key);
