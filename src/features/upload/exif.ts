import type { UploadExif } from './upload.types';

type RawExif = Record<string, unknown> | null | undefined;

const EMPTY_EXIF: UploadExif = {
  taken_at: null,
  camera: null,
  iso: null,
  aperture: null,
  shutter: null,
  focal_length: null,
  location_lat: null,
  location_lng: null,
};

const numberOrNull = (value: unknown): number | null => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return value;
};

const dateOrNull = (value: unknown): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'string' && value.trim()) return value;
  return null;
};

const cameraOrNull = (make: unknown, model: unknown): string | null => {
  const parts = [make, model]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim());
  if (parts.length === 0) return null;
  return Array.from(new Set(parts)).join(' ');
};

const shutterOrNull = (value: unknown): string | null => {
  const exposure = numberOrNull(value);
  if (!exposure || exposure <= 0) return null;
  if (exposure < 1) return `1/${Math.round(1 / exposure)}`;
  return `${Number(exposure.toFixed(3))}s`;
};

export function formatExifTakenAt(value: string | null, timeZone?: string): string {
  if (!value) return '--';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const parts = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    ...(timeZone ? { timeZone } : {}),
  }).formatToParts(date);

  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')} ${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
}

export function normalizeExif(raw: RawExif): UploadExif {
  if (!raw) return { ...EMPTY_EXIF };

  return {
    taken_at: dateOrNull(raw.DateTimeOriginal ?? raw.CreateDate ?? raw.ModifyDate),
    camera: cameraOrNull(raw.Make, raw.Model),
    iso: numberOrNull(raw.ISO),
    aperture: numberOrNull(raw.FNumber),
    shutter: shutterOrNull(raw.ExposureTime),
    focal_length: numberOrNull(raw.FocalLength),
    location_lat: numberOrNull(raw.latitude ?? raw.GPSLatitude),
    location_lng: numberOrNull(raw.longitude ?? raw.GPSLongitude),
  };
}
