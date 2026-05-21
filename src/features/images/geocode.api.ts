export interface GeocodeResult {
  name: string;
  lat: number;
  lng: number;
}

export type GeocodeRegion = 'cn' | 'global';

export async function searchLocations(query: string, region: GeocodeRegion = 'cn'): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({ q: trimmed, region });
  const response = await fetch(`/api/geocode?${params.toString()}`);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`位置搜索失败：${response.status} ${text}`.trim());
  }

  return (await response.json()) as GeocodeResult[];
}
