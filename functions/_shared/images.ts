// 阶段 5：functions 与 src 是两个独立 tsconfig，functions 不能 import src/。
// ImageRecord 在前后端各声明一份，字段保持一致。
// 后续如果接口字段变化，两边一起改即可，比强行共享类型简单。

export interface ImageRecord {
  key: string;
  title: string;
  caption: string | null;
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
}

// D1 表里的原始行形状（只声明 list / detail 接口会用到的列）。
export interface ImageRow {
  key: string;
  title: string;
  caption: string | null;
  r2_key: string;
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
}

export function rowToRecord(row: ImageRow, publicBaseUrl: string): ImageRecord {
  return {
    key: row.key,
    title: row.title,
    caption: row.caption,
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
  };
}
