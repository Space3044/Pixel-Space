export interface GeocodeResult {
  name: string;
  lat: number;
  lng: number;
}

export const validCoordinate = (value: unknown, min: number, max: number): number | null => {
  const number = typeof value === 'string' || typeof value === 'number' ? Number(value) : Number.NaN;
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return number;
};

export const dedupeGeocodeResults = (results: GeocodeResult[]): GeocodeResult[] => {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = `${result.name}|${result.lat.toFixed(6)}|${result.lng.toFixed(6)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
