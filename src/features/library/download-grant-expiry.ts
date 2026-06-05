export type DownloadGrantExpiryPreset = '1d' | '7d' | '30d' | 'custom';

export interface DownloadGrantExpiryOption {
  value: DownloadGrantExpiryPreset;
  label: string;
}

export const DEFAULT_DOWNLOAD_GRANT_PRESET: DownloadGrantExpiryPreset = '7d';

export const DOWNLOAD_GRANT_EXPIRY_OPTIONS: DownloadGrantExpiryOption[] = [
  { value: '1d', label: '1天' },
  { value: '7d', label: '7天' },
  { value: '30d', label: '30天' },
  { value: 'custom', label: '自定义' },
];

const PRESET_DAYS: Record<Exclude<DownloadGrantExpiryPreset, 'custom'>, number> = {
  '1d': 1,
  '7d': 7,
  '30d': 30,
};

const BEIJING_DATE_TIME_FORMAT = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export const buildDownloadGrantExpiry = (
  preset: DownloadGrantExpiryPreset,
  customValue: string,
  now = new Date(),
): string | null => {
  if (preset !== 'custom') {
    const expiresAt = new Date(now.getTime() + PRESET_DAYS[preset] * 24 * 60 * 60 * 1000);
    return expiresAt.toISOString();
  }

  if (!customValue) return null;
  const custom = new Date(customValue);
  if (Number.isNaN(custom.getTime()) || custom.getTime() <= now.getTime()) return null;
  return custom.toISOString();
};

export const formatDownloadGrantExpiry = (expiresAt: string): string => {
  const parts = BEIJING_DATE_TIME_FORMAT.formatToParts(new Date(expiresAt));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `北京时间 ${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}`;
};
