import { badRequest, json, serverError } from '../_shared/http';
import type { Env } from '../types';

type GeocodeRegion = 'cn' | 'global';
type ProviderResults = GeocodeResult[] | null;

interface AmapPoi {
  name?: unknown;
  pname?: unknown;
  cityname?: unknown;
  adname?: unknown;
  address?: unknown;
  location?: unknown;
}

interface AmapGeocode {
  formatted_address?: unknown;
  province?: unknown;
  city?: unknown;
  district?: unknown;
  street?: unknown;
  location?: unknown;
}

interface MapTilerFeature {
  place_name?: unknown;
  text?: unknown;
  center?: unknown;
  geometry?: {
    coordinates?: unknown;
  };
}

interface NominatimResult {
  display_name?: unknown;
  lat?: unknown;
  lon?: unknown;
}

interface PhotonFeature {
  properties?: {
    name?: unknown;
    city?: unknown;
    state?: unknown;
    country?: unknown;
  };
  geometry?: {
    coordinates?: unknown;
  };
}

export interface GeocodeResult {
  name: string;
  lat: number;
  lng: number;
}

const AMAP_PLACE_TEXT_URL = 'https://restapi.amap.com/v3/place/text';
const AMAP_GEOCODE_URL = 'https://restapi.amap.com/v3/geocode/geo';
const MAPTILER_GEOCODING_BASE_URL = 'https://api.maptiler.com/geocoding/';
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const PHOTON_SEARCH_URL = 'https://photon.komoot.io/api/';
const CITY_PREFIXES = [
  '北京',
  '上海',
  '天津',
  '重庆',
  '广州',
  '深圳',
  '厦门',
  '杭州',
  '南京',
  '苏州',
  '成都',
  '武汉',
  '西安',
  '长沙',
  '青岛',
  '福州',
];

const GCJ_A = 6378245;
const GCJ_EE = 0.006693421622965943;
const PI = Math.PI;

const normalizeQuery = (request: Request): string => {
  const value = new URL(request.url).searchParams.get('q') ?? '';
  return value.trim().slice(0, 100);
};

const normalizeRegion = (request: Request): GeocodeRegion | null => {
  const value = new URL(request.url).searchParams.get('region') ?? 'cn';
  if (value === 'cn' || value === 'global') return value;
  return null;
};

const requestOrigin = (request: Request): string => {
  const origin = request.headers.get('origin') ?? new URL(request.url).origin;
  return origin.endsWith('/') ? origin : `${origin}/`;
};

const validCoordinate = (value: unknown, min: number, max: number): number | null => {
  const number = typeof value === 'string' || typeof value === 'number' ? Number(value) : Number.NaN;
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return number;
};

const compactParts = (parts: unknown[]): string[] =>
  parts
    .filter((part): part is string => typeof part === 'string')
    .map((part) => part.trim())
    .filter(Boolean);

const parseLngLat = (value: unknown): { lng: number; lat: number } | null => {
  if (typeof value === 'string') {
    const [lngValue, latValue] = value.split(',');
    const lng = validCoordinate(lngValue, -180, 180);
    const lat = validCoordinate(latValue, -90, 90);
    return lng === null || lat === null ? null : { lng, lat };
  }

  if (Array.isArray(value)) {
    const lng = validCoordinate(value[0], -180, 180);
    const lat = validCoordinate(value[1], -90, 90);
    return lng === null || lat === null ? null : { lng, lat };
  }

  return null;
};

const isOutsideChina = (lng: number, lat: number): boolean =>
  lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;

const transformLat = (lng: number, lat: number): number => {
  let ret = -100 + 2 * lng + 3 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
  ret += ((20 * Math.sin(6 * lng * PI) + 20 * Math.sin(2 * lng * PI)) * 2) / 3;
  ret += ((20 * Math.sin(lat * PI) + 40 * Math.sin((lat / 3) * PI)) * 2) / 3;
  ret += ((160 * Math.sin((lat / 12) * PI) + 320 * Math.sin((lat * PI) / 30)) * 2) / 3;
  return ret;
};

const transformLng = (lng: number, lat: number): number => {
  let ret = 300 + lng + 2 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
  ret += ((20 * Math.sin(6 * lng * PI) + 20 * Math.sin(2 * lng * PI)) * 2) / 3;
  ret += ((20 * Math.sin(lng * PI) + 40 * Math.sin((lng / 3) * PI)) * 2) / 3;
  ret += ((150 * Math.sin((lng / 12) * PI) + 300 * Math.sin((lng / 30) * PI)) * 2) / 3;
  return ret;
};

const gcj02ToWgs84 = (lng: number, lat: number): { lng: number; lat: number } => {
  if (isOutsideChina(lng, lat)) return { lng, lat };

  let dLat = transformLat(lng - 105, lat - 35);
  let dLng = transformLng(lng - 105, lat - 35);
  const radLat = (lat / 180) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - GCJ_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180) / (((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180) / ((GCJ_A / sqrtMagic) * Math.cos(radLat) * PI);
  const gcjLat = lat + dLat;
  const gcjLng = lng + dLng;

  return {
    lng: lng * 2 - gcjLng,
    lat: lat * 2 - gcjLat,
  };
};

const normalizeAmapLocation = (location: unknown): { lng: number; lat: number } | null => {
  const gcj = parseLngLat(location);
  if (!gcj) return null;
  return gcj02ToWgs84(gcj.lng, gcj.lat);
};

const normalizeAmapPoi = (row: AmapPoi): GeocodeResult | null => {
  const location = normalizeAmapLocation(row.location);
  if (!location) return null;

  const name = compactParts([row.name, row.pname, row.cityname, row.adname, row.address]).join('，');
  if (!name) return null;

  return { name, lat: location.lat, lng: location.lng };
};

const normalizeAmapGeocode = (row: AmapGeocode): GeocodeResult | null => {
  const location = normalizeAmapLocation(row.location);
  if (!location) return null;

  const name = compactParts([row.formatted_address, row.province, row.city, row.district, row.street]).join('，');
  if (!name) return null;

  return { name, lat: location.lat, lng: location.lng };
};

const normalizeMapTilerFeature = (feature: MapTilerFeature): GeocodeResult | null => {
  const coordinates = parseLngLat(feature.geometry?.coordinates ?? feature.center);
  if (!coordinates) return null;

  const name = compactParts([feature.place_name, feature.text])[0];
  if (!name) return null;

  return { name, lat: coordinates.lat, lng: coordinates.lng };
};

const normalizeNominatimResult = (row: NominatimResult): GeocodeResult | null => {
  if (typeof row.display_name !== 'string' || !row.display_name.trim()) return null;
  const lat = validCoordinate(row.lat, -90, 90);
  const lng = validCoordinate(row.lon, -180, 180);
  if (lat === null || lng === null) return null;
  return {
    name: row.display_name.trim(),
    lat,
    lng,
  };
};

const normalizePhotonFeature = (feature: PhotonFeature): GeocodeResult | null => {
  const coordinates = parseLngLat(feature.geometry?.coordinates);
  if (!coordinates) return null;

  const name = compactParts([
    feature.properties?.name,
    feature.properties?.city,
    feature.properties?.state,
    feature.properties?.country,
  ]).join('，');
  if (!name) return null;

  return { name, lat: coordinates.lat, lng: coordinates.lng };
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

const queryVariants = (query: string): string[] => {
  const variants = [query];
  if (/\s/.test(query)) return variants;

  const city = CITY_PREFIXES.find((prefix) => query.startsWith(prefix) && query.length > prefix.length);
  if (city) variants.push(`${city} ${query.slice(city.length)}`);

  return variants;
};

const fetchAmapPlaceText = async (query: string, key: string): Promise<GeocodeResult[]> => {
  const url = new URL(AMAP_PLACE_TEXT_URL);
  url.searchParams.set('key', key);
  url.searchParams.set('keywords', query);
  url.searchParams.set('offset', '5');
  url.searchParams.set('page', '1');
  url.searchParams.set('extensions', 'base');

  const response = await fetch(url.toString(), {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) throw new Error(`amap_place_http_${response.status}`);

  const data = (await response.json()) as { status?: unknown; info?: unknown; pois?: unknown };
  if (data.status !== '1') throw new Error(`amap_place_${String(data.info ?? 'failed')}`);
  if (!Array.isArray(data.pois)) return [];

  return data
    .pois
    .map((row) => normalizeAmapPoi(row as AmapPoi))
    .filter((row): row is GeocodeResult => row !== null);
};

const fetchAmapGeocode = async (query: string, key: string): Promise<GeocodeResult[]> => {
  const url = new URL(AMAP_GEOCODE_URL);
  url.searchParams.set('key', key);
  url.searchParams.set('address', query);
  url.searchParams.set('output', 'json');

  const response = await fetch(url.toString(), {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) throw new Error(`amap_geocode_http_${response.status}`);

  const data = (await response.json()) as { status?: unknown; info?: unknown; geocodes?: unknown };
  if (data.status !== '1') throw new Error(`amap_geocode_${String(data.info ?? 'failed')}`);
  if (!Array.isArray(data.geocodes)) return [];

  return data
    .geocodes
    .map((row) => normalizeAmapGeocode(row as AmapGeocode))
    .filter((row): row is GeocodeResult => row !== null);
};

const fetchAmap = async (query: string, env: Env): Promise<ProviderResults> => {
  const key = env.AMAP_KEY?.trim();
  if (!key) return null;

  for (const variant of queryVariants(query)) {
    const results = await fetchAmapPlaceText(variant, key);
    if (results.length > 0) return dedupeResults(results);
  }

  for (const variant of queryVariants(query)) {
    const results = await fetchAmapGeocode(variant, key);
    if (results.length > 0) return dedupeResults(results);
  }

  return [];
};

const fetchMapTiler = async (query: string, env: Env): Promise<ProviderResults> => {
  const key = env.MAPTILER_KEY?.trim();
  if (!key) return null;

  const url = new URL(`${encodeURIComponent(query)}.json`, MAPTILER_GEOCODING_BASE_URL);
  url.searchParams.set('key', key);
  url.searchParams.set('limit', '5');

  const response = await fetch(url.toString(), {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) throw new Error(`maptiler_http_${response.status}`);

  const data = (await response.json()) as { features?: unknown };
  if (!Array.isArray(data.features)) return [];

  return dedupeResults(
    data.features
      .map((feature) => normalizeMapTilerFeature(feature as MapTilerFeature))
      .filter((row): row is GeocodeResult => row !== null),
  );
};

const fetchNominatim = async (query: string, request: Request): Promise<GeocodeResult[]> => {
  const url = new URL(NOMINATIM_SEARCH_URL);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '5');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'zh-CN,zh,en');

  const response = await fetch(url.toString(), {
    headers: {
      accept: 'application/json',
      referer: requestOrigin(request),
      'user-agent': 'imgbed-geocoder/0.1',
    },
  });

  if (!response.ok) throw new Error(`nominatim_http_${response.status}`);

  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return dedupeResults(
    data.map((row) => normalizeNominatimResult(row as NominatimResult)).filter((row): row is GeocodeResult => row !== null),
  );
};

const fetchPhoton = async (query: string): Promise<GeocodeResult[]> => {
  const url = new URL(PHOTON_SEARCH_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '5');

  const response = await fetch(url.toString(), {
    headers: {
      accept: 'application/json',
      'user-agent': 'imgbed-geocoder/0.1',
    },
  });

  if (!response.ok) throw new Error(`photon_http_${response.status}`);

  const data = (await response.json()) as { features?: unknown };
  if (!Array.isArray(data.features)) return [];
  return dedupeResults(
    data.features
      .map((feature) => normalizePhotonFeature(feature as PhotonFeature))
      .filter((row): row is GeocodeResult => row !== null),
  );
};

const fetchPhotonVariants = async (query: string): Promise<GeocodeResult[]> => {
  for (const variant of queryVariants(query)) {
    const results = await fetchPhoton(variant);
    if (results.length > 0) return results;
  }
  return [];
};

const providerOrder = (
  region: GeocodeRegion,
  request: Request,
  env: Env,
): Array<[name: string, search: () => Promise<ProviderResults>]> => {
  const sharedFallbacks: Array<[name: string, search: () => Promise<ProviderResults>]> = [
    ['nominatim', () => fetchNominatim(normalizeQuery(request), request)],
    ['photon', () => fetchPhotonVariants(normalizeQuery(request))],
  ];

  if (region === 'global') {
    return [['maptiler', () => fetchMapTiler(normalizeQuery(request), env)], ...sharedFallbacks];
  }

  return [
    ['amap', () => fetchAmap(normalizeQuery(request), env)],
    ['maptiler', () => fetchMapTiler(normalizeQuery(request), env)],
    ...sharedFallbacks,
  ];
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const query = normalizeQuery(request);
  if (!query) return badRequest('missing_geocode_query');

  const region = normalizeRegion(request);
  if (!region) return badRequest('invalid_geocode_region');

  const providerErrors: Record<string, unknown> = {};
  let completedProvider = false;

  for (const [name, search] of providerOrder(region, request, env)) {
    try {
      const results = await search();
      if (results === null) continue;

      completedProvider = true;
      if (results.length > 0) return json(results);
    } catch (error) {
      providerErrors[name] = error;
    }
  }

  if (completedProvider || Object.keys(providerErrors).length === 0) return json([]);

  console.error('GET /api/geocode failed', providerErrors);
  return serverError('geocode_failed');
};
