// 阶段 5：functions 与 src 是两个独立 tsconfig，functions 不能 import src/。
// ImageRecord 在前后端各声明一份，字段保持一致。
// 后续如果接口字段变化，两边一起改即可，比强行共享类型简单。

export interface ImageRecord {
  key: string;
  title: string;
  caption: string | null;
  original_filename: string;
  public_url: string;
  width: number;
  height: number;
  format: string;
  bytes_compressed: number;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  exif_taken_at: string | null;
  exif_camera: string | null;
  exif_iso: number | null;
  exif_aperture: number | null;
  exif_shutter: string | null;
  exif_focal_length: number | null;
  tags_json: string | null;
  ai_status: string;
  ai_error: string | null;
  ai_attempts: number;
  ai_finished_at: string | null;
}

// D1 表里的原始行形状（只声明 list / detail 接口会用到的列）。
export interface ImageRow {
  key: string;
  title: string;
  caption: string | null;
  r2_key: string;
  original_filename: string;
  width: number;
  height: number;
  format: string;
  bytes_compressed: number;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  exif_taken_at: string | null;
  exif_camera: string | null;
  exif_iso: number | null;
  exif_aperture: number | null;
  exif_shutter: string | null;
  exif_focal_length: number | null;
  tags_json: string | null;
  ai_status: string;
  ai_error: string | null;
  ai_attempts: number;
  ai_finished_at: string | null;
}

export const normalizeTagsJson = (value: unknown): string | null => {
  const tags = Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : typeof value === 'string'
      ? value
          .split(/[,，\n]/)
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

  return tags.length > 0 ? JSON.stringify([...new Set(tags)]) : null;
};

export function rowToRecord(row: ImageRow, publicBaseUrl: string): ImageRecord {
  return {
    key: row.key,
    title: row.title,
    caption: row.caption,
    original_filename: row.original_filename,
    public_url: `${publicBaseUrl.replace(/\/$/, '')}/${row.r2_key}`,
    width: row.width,
    height: row.height,
    format: row.format,
    bytes_compressed: row.bytes_compressed,
    location_name: row.location_name,
    location_lat: row.location_lat,
    location_lng: row.location_lng,
    exif_taken_at: row.exif_taken_at,
    exif_camera: row.exif_camera,
    exif_iso: row.exif_iso,
    exif_aperture: row.exif_aperture,
    exif_shutter: row.exif_shutter,
    exif_focal_length: row.exif_focal_length,
    tags_json: row.tags_json,
    ai_status: row.ai_status,
    ai_error: row.ai_error,
    ai_attempts: row.ai_attempts,
    ai_finished_at: row.ai_finished_at,
  };
}
