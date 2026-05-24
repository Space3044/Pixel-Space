-- 0009_add_folders.sql
-- 文件库分类：图片归属到层级文件夹下，类似 Windows 文件管理器。
-- 设计要点：
-- folders(id, parent_id, name, created_at, updated_at)
--   parent_id IS NULL 表示一级目录（在根之下）；UNIQUE(parent_id, name) 防止同级重名。
--   重命名/移动子目录用 PATCH /api/admin/folders/[id]，删除非空目录由应用层拒绝。
-- images.folder_id IS NULL 表示「根」（未分类），与文件夹层级独立。
-- 该模块仅对管理员开放：导航入口、列表、写操作全部需要 requireAdmin。

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

ALTER TABLE images ADD COLUMN folder_id TEXT REFERENCES folders(id);

CREATE INDEX idx_images_folder_id ON images (folder_id);
