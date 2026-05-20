-- 0005_add_original_filename.sql
-- 阶段 11 补充：保存浏览器上传时的原始文件名，用于详情展示和原图下载文件名。

ALTER TABLE images ADD COLUMN original_filename TEXT NOT NULL DEFAULT '';
