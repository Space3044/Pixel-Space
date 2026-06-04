-- 0002_location_region.sql
-- 足迹页按区域分图：国内点走高德、国外点走 Mapbox。
-- 区域优先存用户上传时的选择，这里给新列补位并回填存量。

ALTER TABLE images ADD COLUMN location_region TEXT;

-- 回填已有带坐标的记录：用与前端 isOutsideChina 一致的中国外接边界框判断。
UPDATE images
SET location_region = CASE
  WHEN location_lng < 72.004 OR location_lng > 137.8347
    OR location_lat < 0.8293 OR location_lat > 55.8271 THEN 'global'
  ELSE 'china'
END
WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;
