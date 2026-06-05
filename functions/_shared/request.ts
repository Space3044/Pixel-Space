export async function parseJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const data = (await request.json()) as unknown;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    return data as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function normalizeStringList(
  value: unknown,
  { min, max }: { min: number; max: number },
): string[] | null {
  if (!Array.isArray(value) || value.length < min || value.length > max) return null;
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return null;
    const trimmed = item.trim();
    if (!trimmed) return null;
    result.push(trimmed);
  }
  return result;
}

export const normalizeOptionalString = (value: unknown): string | null | undefined => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return undefined;
  return value.trim() || null;
};

export const stringOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const stringOrEmpty = (value: unknown): string => stringOrNull(value) ?? '';

export const numberOrNull = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
};

export const integerOrNull = (value: unknown): number | null => {
  const number = numberOrNull(value);
  return number === null ? null : Math.round(number);
};

export const coordinateOrNull = (value: unknown, min: number, max: number): number | null => {
  const number = numberOrNull(value);
  if (number === null || number < min || number > max) return null;
  return number;
};

export const optionalCoordinate = (
  value: unknown,
  min: number,
  max: number,
): number | null | undefined => {
  if (value === null || value === undefined || value === '') return null;
  const number = numberOrNull(value);
  if (number === null || number < min || number > max) return undefined;
  return number;
};

export const flagOrDefault = (value: unknown, fallback: 0 | 1): 0 | 1 => {
  if (value === true || value === 1 || value === '1') return 1;
  if (value === false || value === 0 || value === '0') return 0;
  return fallback;
};

export const optionalFlag = (value: unknown): 0 | 1 | null | undefined => {
  if (value === undefined) return null;
  if (value === true || value === 1 || value === '1') return 1;
  if (value === false || value === 0 || value === '0') return 0;
  return undefined;
};
