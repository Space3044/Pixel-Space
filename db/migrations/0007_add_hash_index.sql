-- 0007_add_hash_index.sql
-- 给 images.hash 加索引，用于上传去重的快速查找。
-- 同时把语义从“压缩文件 SHA-256”改为“原始文件 SHA-256”，
-- 调整逻辑在应用层完成；如果存在历史数据，需要由后台脚本回填，这里只建索引。

CREATE INDEX IF NOT EXISTS idx_images_hash ON images (hash);
