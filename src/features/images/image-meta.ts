type JsonTagCarrier = {
  tags_json?: string | null;
};

type JsonPaletteCarrier = {
  color_palette_json?: string | null;
};

const parseStringList = (value: string | null | undefined): string[] => {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
};

export const tagsFromImage = (image: JsonTagCarrier | null | undefined): string[] =>
  parseStringList(image?.tags_json);

export const paletteFromImage = (image: JsonPaletteCarrier | null | undefined): string[] =>
  parseStringList(image?.color_palette_json);

export const parseDominantColor = (value: string | null | undefined): { name: string; hex: string } => {
  const raw = value?.trim() ?? '';
  const hex = raw.match(/#[0-9a-fA-F]{6}\b/)?.[0].toUpperCase() ?? '';
  const name = hex ? raw.replace(new RegExp(hex, 'i'), '').trim() : raw;
  return { name: name || raw || '未记录', hex };
};

export const formatBytes = (bytes: number, emptyText = '未记录'): string => {
  if (bytes <= 0) return emptyText;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
};
