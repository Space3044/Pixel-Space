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
  location_name: string | null;
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
  location_name: string | null;
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
    location_name: row.location_name,
  };
}
