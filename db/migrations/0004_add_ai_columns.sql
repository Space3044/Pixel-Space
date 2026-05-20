-- 0004_add_ai_columns.sql
-- 阶段 11：AI 预览标注字段。代理 URL 和模型名作为全局可修改配置入库，PROXY_KEY 不入库。

ALTER TABLE images ADD COLUMN tags_json TEXT;
ALTER TABLE images ADD COLUMN search_content TEXT;
ALTER TABLE images ADD COLUMN ai_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE images ADD COLUMN ai_error TEXT;
ALTER TABLE images ADD COLUMN ai_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE images ADD COLUMN ai_finished_at TEXT;

CREATE TABLE ai_settings (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  proxy_url  TEXT    NOT NULL DEFAULT '',
  model      TEXT    NOT NULL DEFAULT '',
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO ai_settings (id, proxy_url, model) VALUES (1, '', '');
