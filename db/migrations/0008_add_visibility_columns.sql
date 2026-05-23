-- 0008_add_visibility_columns.sql
-- 给图片加两个独立的可见性开关：
-- is_public：是否进入公开聚合视图（列表 / 搜索 / 随机 / 蜂巢 / 足迹等）。
--   0 表示私藏，访客在聚合接口中看不到这张图，但凭 key 直链仍可访问。
-- location_public：是否对访客暴露位置信息。
--   0 表示访客拿不到 location_lat / location_lng / location_name；详情页地图仍渲染但无标记。
-- 管理员视角不受任何开关影响。默认均为 1，保持历史数据公开行为不变。

ALTER TABLE images ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1;
ALTER TABLE images ADD COLUMN location_public INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_images_is_public_created_at ON images (is_public, created_at DESC);
