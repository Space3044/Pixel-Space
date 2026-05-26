-- 0011_add_ai_prompt.sql
-- AI 分析提示词入库，方便管理员在控制台直接调整。

ALTER TABLE ai_settings ADD COLUMN prompt TEXT NOT NULL DEFAULT '';
