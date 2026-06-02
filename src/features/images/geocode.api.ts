import { readHttpError } from '@/shared/api/http';
import { loadAmap } from '@/features/upload/amap';
import { gcj02ToWgs84, wgs84ToGcj02 } from '@/features/upload/map-coordinate';
import { formatLocationName } from './location-name';
import type { AMapNamespace } from '@/features/upload/amap';

export interface GeocodeResult {
  name: string;
  lat: number;
  lng: number;
}

export type GeocodeRegion = 'cn' | 'global';

interface AmapPoi {
  name?: unknown;
  pname?: unknown;
  cityname?: unknown;
  adname?: unknown;
  address?: unknown;
  location?: unknown;
}

interface AmapGeocode {
  formattedAddress?: unknown;
  formatted_address?: unknown;
  province?: unknown;
  city?: unknown;
  district?: unknown;
  township?: unknown;
  street?: unknown;
  location?: unknown;
}

interface AmapReverseGeocode {
  formattedAddress?: unknown;
  formatted_address?: unknown;
  addressComponent?: {
    province?: unknown;
    city?: unknown;
    district?: unknown;
    township?: unknown;
    streetNumber?: {
      street?: unknown;
      number?: unknown;
    };
  };
}

interface AmapSearchPayload {
  info?: unknown;
  message?: unknown;
  poiList?: {
    pois?: unknown;
  };
  geocodes?: unknown;
  regeocode?: unknown;
}

const validCoordinate = (value: unknown, min: number, max: number): number | null => {
  const number = typeof value === 'string' || typeof value === 'number' ? Number(value) : Number.NaN;
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return number;
};

const parseAmapLngLat = (value: unknown): { lng: number; lat: number } | null => {
  if (!value || typeof value !== 'object') return null;

  const row = value as {
    getLng?: unknown;
    getLat?: unknown;
    lng?: unknown;
    lat?: unknown;
  };

  const lngValue = typeof row.getLng === 'function' ? row.getLng() : row.lng;
  const latValue = typeof row.getLat === 'function' ? row.getLat() : row.lat;
  const lng = validCoordinate(lngValue, -180, 180);
  const lat = validCoordinate(latValue, -90, 90);

  return lng === null || lat === null ? null : { lng, lat };
};

const normalizeAmapPoi = (row: AmapPoi, reverse?: AmapReverseGeocode | null): GeocodeResult | null => {
  const gcj = parseAmapLngLat(row.location);
  if (!gcj) return null;

  const stored = gcj02ToWgs84(gcj.lng, gcj.lat);
  const component = reverse?.addressComponent;
  const name = formatLocationName({
    title: row.name,
    regionParts: [
      component?.province ?? row.pname,
      component?.city ?? row.cityname,
      component?.district ?? row.adname,
      component?.township,
    ],
    detailParts: [row.address, component?.streetNumber?.street, component?.streetNumber?.number],
  });
  if (!name) return null;

  return { name, lat: stored.lat, lng: stored.lng };
};

const normalizeAmapGeocode = (row: AmapGeocode): GeocodeResult | null => {
  const gcj = parseAmapLngLat(row.location);
  if (!gcj) return null;

  const stored = gcj02ToWgs84(gcj.lng, gcj.lat);
  const name = formatLocationName({
    title: row.formattedAddress ?? row.formatted_address,
    regionParts: [row.province, row.city, row.district, row.township],
    detailParts: [row.street],
  });
  if (!name) return null;

  return { name, lat: stored.lat, lng: stored.lng };
};

const dedupeResults = (results: GeocodeResult[]): GeocodeResult[] => {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = `${result.name}|${result.lat.toFixed(6)}|${result.lng.toFixed(6)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const amapErrorCode = (status: string, result: unknown): string => {
  if (typeof result === 'string' && result.trim()) return result.trim();
  if (result && typeof result === 'object') {
    const payload = result as AmapSearchPayload;
    for (const value of [payload.info, payload.message]) {
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return status || 'failed';
};

const searchAmapPlaceRows = (amap: AMapNamespace, keyword: string): Promise<AmapPoi[]> =>
  new Promise((resolve, reject) => {
    const service = new amap.PlaceSearch({ pageSize: 5, pageIndex: 1, city: '全国', extensions: 'base' });
    service.search(keyword, (status, result) => {
      if (status === 'no_data') {
        resolve([]);
        return;
      }
      if (status !== 'complete') {
        reject(new Error(`amap_place_${amapErrorCode(status, result)}`));
        return;
      }

      const pois = (result as AmapSearchPayload).poiList?.pois;
      if (!Array.isArray(pois)) {
        resolve([]);
        return;
      }

      resolve(pois as AmapPoi[]);
    });
  });

const reverseGeocodeAmapLocation = (
  geocoder: InstanceType<AMapNamespace['Geocoder']>,
  gcj: { lng: number; lat: number },
): Promise<AmapReverseGeocode | null> =>
  new Promise((resolve) => {
    geocoder.getAddress([gcj.lng, gcj.lat], (status, result) => {
      if (status !== 'complete') {
        resolve(null);
        return;
      }

      const reverse = (result as AmapSearchPayload).regeocode;
      resolve(reverse && typeof reverse === 'object' ? (reverse as AmapReverseGeocode) : null);
    });
  });

const enrichAmapPoi = async (
  geocoder: InstanceType<AMapNamespace['Geocoder']>,
  row: AmapPoi,
): Promise<GeocodeResult | null> => {
  const gcj = parseAmapLngLat(row.location);
  if (!gcj) return null;

  const reverse = await reverseGeocodeAmapLocation(geocoder, gcj);
  return normalizeAmapPoi(row, reverse);
};

const enrichAmapPois = async (amap: AMapNamespace, pois: AmapPoi[]): Promise<GeocodeResult[]> => {
  const geocoder = new amap.Geocoder({ city: '全国' });
  const results: GeocodeResult[] = [];

  for (const row of pois) {
    const result = await enrichAmapPoi(geocoder, row);
    if (result) results.push(result);
  }

  return dedupeResults(results);
};

const searchAmapPlaces = async (amap: AMapNamespace, keyword: string): Promise<GeocodeResult[]> => {
  const pois = await searchAmapPlaceRows(amap, keyword);
  return enrichAmapPois(amap, pois);
};

const geocodeAmapAddress = (amap: AMapNamespace, keyword: string): Promise<GeocodeResult[]> =>
  new Promise((resolve, reject) => {
    const service = new amap.Geocoder({ city: '全国' });
    service.getLocation(keyword, (status, result) => {
      if (status === 'no_data') {
        resolve([]);
        return;
      }
      if (status !== 'complete') {
        reject(new Error(`amap_geocode_${amapErrorCode(status, result)}`));
        return;
      }

      const geocodes = (result as AmapSearchPayload).geocodes;
      if (!Array.isArray(geocodes)) {
        resolve([]);
        return;
      }

      resolve(
        dedupeResults(
          geocodes.map((geocode) => normalizeAmapGeocode(geocode as AmapGeocode)).filter((row): row is GeocodeResult => row !== null),
        ),
      );
    });
  });

const searchAmapLocations = async (keyword: string): Promise<GeocodeResult[]> => {
  const amap = await loadAmap();
  const placeResults = await searchAmapPlaces(amap, keyword);
  if (placeResults.length > 0) return placeResults;

  return geocodeAmapAddress(amap, keyword);
};

const searchGlobalLocations = async (keyword: string): Promise<GeocodeResult[]> => {
  const params = new URLSearchParams({ q: keyword, region: 'global' });
  const response = await fetch(`/api/geocode?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`位置搜索失败：${await readHttpError(response)}`);
  }

  return (await response.json()) as GeocodeResult[];
};

const normalizeSearchError = (error: unknown): Error => {
  const message = error instanceof Error && error.message.trim() ? error.message.trim() : String(error);
  return message.startsWith('位置搜索失败：') ? new Error(message) : new Error(`位置搜索失败：${message}`);
};

export async function searchLocations(query: string, region: GeocodeRegion = 'cn'): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    if (region === 'cn') return await searchAmapLocations(trimmed);
    return await searchGlobalLocations(trimmed);
  } catch (error) {
    throw normalizeSearchError(error);
  }
}

export async function reverseGeocodeLocation(lat: number, lng: number): Promise<string | null> {
  const amap = await loadAmap();
  const gcj = wgs84ToGcj02(lng, lat);
  const geocoder = new amap.Geocoder({ city: '全国' });
  const reverse = await reverseGeocodeAmapLocation(geocoder, gcj);
  if (!reverse) return null;
  const component = reverse.addressComponent;
  return formatLocationName({
    title: reverse.formattedAddress ?? reverse.formatted_address,
    regionParts: [component?.province, component?.city, component?.district, component?.township],
    detailParts: [component?.streetNumber?.street, component?.streetNumber?.number],
  });
}