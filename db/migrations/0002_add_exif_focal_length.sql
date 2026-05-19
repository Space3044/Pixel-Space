-- 0002_add_exif_focal_length.sql
-- 阶段 8：阶段 7 已解析焦距，上传闭环落库时保留该 EXIF 字段。

ALTER TABLE images ADD COLUMN exif_focal_length REAL;
