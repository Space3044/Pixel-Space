-- 0006_add_ai_visual_fields.sql
-- AI 视觉分析补充字段：主色调、色板、构图。

ALTER TABLE images ADD COLUMN dominant_color TEXT;
ALTER TABLE images ADD COLUMN color_palette_json TEXT;
ALTER TABLE images ADD COLUMN composition TEXT;
