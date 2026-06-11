import type { Env } from '../types';
import { resolveAdmin } from './auth';
import { badRequest, json, serverError, unauthorized } from './http';
import type { RequestLogger } from './logger';
import { dedupeGeocodeResults, validCoordinate, type GeocodeResult } from '../../shared/geocode';

type GeocodeRegion = 'cn' | 'global';
type ProviderResults = GeocodeResult[] | null;
type ProviderName = 'mapbox' | 'maptiler' | 'nominatim';
type ProviderOutcome = 'skipped' | 'empty' | 'error' | 'hit';
type ReverseCoordinate = { lng: number; lat: number };
type GeocodeInput =
  | { kind: 'search'; query: string }
  | { kind: 'reverse'; coordinate: ReverseCoordinate };

interface ProviderAttemptLog {
  provider: ProviderName;
  outcome: ProviderOutcome;
  resultCount: number;
  durationMs: number;
  error?: string;
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

const MAPTILER_GEOCODING_BASE_URL = 'https://api.maptiler.com/geocoding/';
const MAPBOX_GEOCODING_BASE_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places/';
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const GLOBAL_GEOCODE_LANGUAGE = 'en';

const normalizeQuery = (request: Request): string => {
  const value = new URL(request.url).searchParams.get('q') ?? '';
  return value.trim().slice(0, 100);
};

const normalizeRegion = (request: Request): GeocodeRegion | null => {
  const value = new URL(request.url).searchParams.get('region') ?? 'global';
  if (value === 'cn' || value === 'global') return value;
  return null;
};

const readReverseCoordinate = (request: Request): ReverseCoordinate | null | 'invalid' => {
  const params = new URL(request.url).searchParams;
  if (!params.has('lat') && !params.has('lng')) return null;

  const lat = validCoordinate(params.get('lat'), -90, 90);
  const lng = validCoordinate(params.get('lng'), -180, 180);
  return lat === null || lng === null ? 'invalid' : { lng, lat };
};

const requestOrigin = (request: Request): string => {
  const origin = request.headers.get('origin') ?? new URL(request.url).origin;
  return origin.endsWith('/') ? origin : `${origin}/`;
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

const normalizeNominatimReverseResult = (
  row: NominatimResult,
  fallback: ReverseCoordinate,
): GeocodeResult | null => {
  if (typeof row.display_name !== 'string' || !row.display_name.trim()) return null;
  return {
    name: row.display_name.trim(),
    lat: validCoordinate(row.lat, -90, 90) ?? fallback.lat,
    lng: validCoordinate(row.lon, -180, 180) ?? fallback.lng,
  };
};

const errorMessage = (error: unknown): string =>
  error instanceof Error && error.message.trim() ? error.message.trim() : String(error);

const fetchMapTiler = async (query: string, env: Env): Promise<ProviderResults> => {
  const key = env.MAPTILER_KEY?.trim();
  if (!key) return null;

  const url = new URL(`${encodeURIComponent(query)}.json`, MAPTILER_GEOCODING_BASE_URL);
  url.searchParams.set('key', key);
  url.searchParams.set('limit', '5');
  url.searchParams.set('language', GLOBAL_GEOCODE_LANGUAGE);

  const response = await fetch(url.toString(), {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) throw new Error(`maptiler_http_${response.status}`);

  const data = (await response.json()) as { features?: unknown };
  if (!Array.isArray(data.features)) return [];

  return dedupeGeocodeResults(
    data.features
      .map((feature) => normalizeMapTilerFeature(feature as MapTilerFeature))
      .filter((row): row is GeocodeResult => row !== null),
  );
};

const fetchMapbox = async (query: string, env: Env): Promise<ProviderResults> => {
  const token = env.MAPBOX_PUBLIC_TOKEN?.trim();
  if (!token) return null;

  const url = new URL(`${encodeURIComponent(query)}.json`, MAPBOX_GEOCODING_BASE_URL);
  url.searchParams.set('access_token', token);
  url.searchParams.set('limit', '5');
  url.searchParams.set('language', GLOBAL_GEOCODE_LANGUAGE);

  const response = await fetch(url.toString(), {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) throw new Error(`mapbox_http_${response.status}`);

  const data = (await response.json()) as { features?: unknown };
  if (!Array.isArray(data.features)) return [];

  return dedupeGeocodeResults(
    data.features
      .map((feature) => normalizeMapTilerFeature(feature as MapTilerFeature))
      .filter((row): row is GeocodeResult => row !== null),
  );
};

const fetchMapTilerReverse = async (coordinate: ReverseCoordinate, env: Env): Promise<ProviderResults> => {
  const key = env.MAPTILER_KEY?.trim();
  if (!key) return null;

  const url = new URL(`${coordinate.lng},${coordinate.lat}.json`, MAPTILER_GEOCODING_BASE_URL);
  url.searchParams.set('key', key);
  url.searchParams.set('limit', '1');
  url.searchParams.set('language', GLOBAL_GEOCODE_LANGUAGE);

  const response = await fetch(url.toString(), {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) throw new Error(`maptiler_http_${response.status}`);

  const data = (await response.json()) as { features?: unknown };
  if (!Array.isArray(data.features)) return [];

  return dedupeGeocodeResults(
    data.features
      .map((feature) => normalizeMapTilerFeature(feature as MapTilerFeature))
      .filter((row): row is GeocodeResult => row !== null),
  );
};

const fetchMapboxReverse = async (coordinate: ReverseCoordinate, env: Env): Promise<ProviderResults> => {
  const token = env.MAPBOX_PUBLIC_TOKEN?.trim();
  if (!token) return null;

  const url = new URL(`${coordinate.lng},${coordinate.lat}.json`, MAPBOX_GEOCODING_BASE_URL);
  url.searchParams.set('access_token', token);
  url.searchParams.set('language', GLOBAL_GEOCODE_LANGUAGE);

  const response = await fetch(url.toString(), {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) throw new Error(`mapbox_http_${response.status}`);

  const data = (await response.json()) as { features?: unknown };
  if (!Array.isArray(data.features)) return [];

  return dedupeGeocodeResults(
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
  url.searchParams.set('accept-language', GLOBAL_GEOCODE_LANGUAGE);

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
  return dedupeGeocodeResults(
    data.map((row) => normalizeNominatimResult(row as NominatimResult)).filter((row): row is GeocodeResult => row !== null),
  );
};

const fetchNominatimReverse = async (
  coordinate: ReverseCoordinate,
  request: Request,
): Promise<GeocodeResult[]> => {
  const url = new URL(NOMINATIM_REVERSE_URL);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(coordinate.lat));
  url.searchParams.set('lon', String(coordinate.lng));
  url.searchParams.set('zoom', '18');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', GLOBAL_GEOCODE_LANGUAGE);

  const response = await fetch(url.toString(), {
    headers: {
      accept: 'application/json',
      referer: requestOrigin(request),
      'user-agent': 'imgbed-geocoder/0.1',
    },
  });

  if (!response.ok) throw new Error(`nominatim_http_${response.status}`);

  const data = (await response.json()) as unknown;
  const result = normalizeNominatimReverseResult(data as NominatimResult, coordinate);
  return result ? [result] : [];
};

const providerOrder = (
  request: Request,
  env: Env,
  input: GeocodeInput,
): Array<[name: ProviderName, search: () => Promise<ProviderResults>]> => {
  if (input.kind === 'reverse') {
    const providers: Array<[name: ProviderName, search: () => Promise<ProviderResults>]> = [
      ['mapbox', () => fetchMapboxReverse(input.coordinate, env)],
      ['maptiler', () => fetchMapTilerReverse(input.coordinate, env)],
    ];
    providers.push(['nominatim', () => fetchNominatimReverse(input.coordinate, request)]);
    return providers;
  }

  return [
    ['mapbox', () => fetchMapbox(input.query, env)],
    ['maptiler', () => fetchMapTiler(input.query, env)],
    ['nominatim', () => fetchNominatim(input.query, request)],
  ];
};

const logProviderAttempts = (
  logger: RequestLogger,
  input: GeocodeInput,
  region: GeocodeRegion,
  attempts: ProviderAttemptLog[],
): void => {
  logger.info('geocode provider attempts', {
    context: {
      kind: input.kind,
      region,
      attempts,
    },
  });
};

export const handleGeocodeGet = async (
  { request, env }: EventContext<Env, string, Record<string, unknown>>,
  logger: RequestLogger,
): Promise<Response> => {
  if (!(await resolveAdmin(request, env))) return unauthorized();

  const region = normalizeRegion(request);
  if (!region) return badRequest('invalid_geocode_region');
  if (region === 'cn') return badRequest('domestic_geocode_uses_amap_js_api');

  const reverseCoordinate = readReverseCoordinate(request);
  if (reverseCoordinate === 'invalid') return badRequest('invalid_geocode_coordinate');

  const query = normalizeQuery(request);
  const input: GeocodeInput = reverseCoordinate
    ? { kind: 'reverse', coordinate: reverseCoordinate }
    : { kind: 'search', query };
  if (input.kind === 'search' && !input.query) return badRequest('missing_geocode_query');

  const providerErrors: Record<string, unknown> = {};
  const providerAttempts: ProviderAttemptLog[] = [];
  let completedProvider = false;

  for (const [name, search] of providerOrder(request, env, input)) {
    const startedAt = Date.now();
    try {
      const results = await search();
      const durationMs = Date.now() - startedAt;
      if (results === null) {
        providerAttempts.push({ provider: name, outcome: 'skipped', resultCount: 0, durationMs });
        continue;
      }

      completedProvider = true;
      providerAttempts.push({
        provider: name,
        outcome: results.length > 0 ? 'hit' : 'empty',
        resultCount: results.length,
        durationMs,
      });
      if (results.length > 0) {
        logProviderAttempts(logger, input, region, providerAttempts);
        return json(results);
      }
    } catch (error) {
      providerAttempts.push({
        provider: name,
        outcome: 'error',
        resultCount: 0,
        durationMs: Date.now() - startedAt,
        error: errorMessage(error),
      });
      providerErrors[name] = error;
    }
  }

  logProviderAttempts(logger, input, region, providerAttempts);

  if (completedProvider || Object.keys(providerErrors).length === 0) return json([]);

  const firstError = Object.values(providerErrors)[0];
  logger.error('GET /api/admin/geocode failed', {
    error: firstError,
    context: {
      kind: input.kind,
      region,
      attempts: providerAttempts,
      firstError: errorMessage(firstError),
    },
  });
  return serverError(firstError ? errorMessage(firstError) : 'geocode_failed');
};
