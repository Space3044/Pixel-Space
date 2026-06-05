-- 0003_download_grants.sql
-- Visitor access-code grants for original-image downloads.

CREATE TABLE download_grants (
  id         TEXT PRIMARY KEY NOT NULL,
  code_hash  TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_download_grants_expires_at ON download_grants (expires_at);

CREATE TABLE download_grant_images (
  grant_id  TEXT NOT NULL,
  image_key TEXT NOT NULL,
  PRIMARY KEY (grant_id, image_key),
  FOREIGN KEY (grant_id) REFERENCES download_grants(id) ON DELETE CASCADE,
  FOREIGN KEY (image_key) REFERENCES images(key) ON DELETE CASCADE
);

CREATE INDEX idx_download_grant_images_image_key ON download_grant_images (image_key);
