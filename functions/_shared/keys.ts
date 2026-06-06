export const IMAGE_OBJECT_PREFIX = 'images/';

const decodeRouteSegment = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const createImageKey = (): string => `${IMAGE_OBJECT_PREFIX}${crypto.randomUUID()}`;

export const keyFromRouteParam = (value: unknown): string => {
  if (Array.isArray(value)) return value.map((part) => decodeRouteSegment(String(part))).join('/');
  return decodeRouteSegment(String(value ?? ''));
};
