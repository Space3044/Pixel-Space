type Coordinate = [number, number];
type Ring = Coordinate[];
type Polygon = Ring[];

interface GeoJsonFeature {
  type?: string;
  properties?: {
    name?: unknown;
  };
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
}

interface GeoJsonFeatureCollection {
  features?: unknown;
}

interface RegionPolygon {
  name: string;
  rings: Polygon;
  bbox: {
    minLng: number;
    maxLng: number;
    minLat: number;
    maxLat: number;
  };
  area: number;
}

export interface GeoHitIndex {
  regions: RegionPolygon[];
}

const isCoordinate = (value: unknown): value is Coordinate => (
  Array.isArray(value)
  && value.length >= 2
  && typeof value[0] === 'number'
  && typeof value[1] === 'number'
  && Number.isFinite(value[0])
  && Number.isFinite(value[1])
);

const normalizeLongitude = (lng: number) => {
  if (!Number.isFinite(lng)) return lng;
  return ((((lng + 180) % 360) + 360) % 360) - 180;
};

const collectFeatures = (data: GeoJsonFeatureCollection): GeoJsonFeature[] => {
  if (!Array.isArray(data.features)) return [];
  return data.features.filter((feature): feature is GeoJsonFeature => (
    Boolean(feature)
    && typeof feature === 'object'
    && (feature as GeoJsonFeature).type === 'Feature'
  ));
};

const polygonArea = (ring: Ring) => {
  let area = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    area += current[0] * next[1] - next[0] * current[1];
  }
  return Math.abs(area) / 2;
};

const buildRegionPolygon = (name: string, rings: Polygon): RegionPolygon | null => {
  const validRings = rings
    .map((ring) => ring.filter(isCoordinate))
    .filter((ring) => ring.length >= 3);

  if (validRings.length === 0) return null;

  let minLng = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  for (const ring of validRings) {
    for (const [lng, lat] of ring) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  }

  const exteriorArea = polygonArea(validRings[0]);
  const holesArea = validRings.slice(1).reduce((total, ring) => total + polygonArea(ring), 0);

  return {
    name,
    rings: validRings,
    bbox: { minLng, maxLng, minLat, maxLat },
    area: Math.max(exteriorArea - holesArea, 0),
  };
};

const addFeaturePolygons = (regions: RegionPolygon[], feature: GeoJsonFeature, parentName?: string) => {
  const rawName = feature.properties?.name;
  if (typeof rawName !== 'string' || !rawName.trim()) return;

  const name = parentName ? `${parentName}-${rawName.trim()}` : rawName.trim();
  if (!parentName && name === '中国') return;

  const geometry = feature.geometry;
  if (!geometry) return;

  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
    const polygon = buildRegionPolygon(name, geometry.coordinates as Polygon);
    if (polygon) regions.push(polygon);
    return;
  }

  if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
    for (const rings of geometry.coordinates) {
      if (!Array.isArray(rings)) continue;
      const polygon = buildRegionPolygon(name, rings as Polygon);
      if (polygon) regions.push(polygon);
    }
  }
};

export const buildGeoHitIndex = (
  worldData: GeoJsonFeatureCollection,
  chinaData: GeoJsonFeatureCollection,
): GeoHitIndex => {
  const regions: RegionPolygon[] = [];

  for (const feature of collectFeatures(worldData)) {
    addFeaturePolygons(regions, feature);
  }

  for (const feature of collectFeatures(chinaData)) {
    addFeaturePolygons(regions, feature, '中国');
  }

  regions.sort((left, right) => left.area - right.area);
  return { regions };
};

const isPointInsideRing = (lng: number, lat: number, ring: Ring) => {
  let inside = false;

  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [currentLng, currentLat] = ring[index];
    const [previousLng, previousLat] = ring[previous];
    const crosses = (currentLat > lat) !== (previousLat > lat);
    if (!crosses) continue;

    const intersectionLng = ((previousLng - currentLng) * (lat - currentLat)) / (previousLat - currentLat) + currentLng;
    if (lng < intersectionLng) inside = !inside;
  }

  return inside;
};

const isPointInsidePolygon = (lng: number, lat: number, polygon: RegionPolygon) => {
  const { bbox, rings } = polygon;
  if (lng < bbox.minLng || lng > bbox.maxLng || lat < bbox.minLat || lat > bbox.maxLat) return false;
  if (!isPointInsideRing(lng, lat, rings[0])) return false;
  return !rings.slice(1).some((ring) => isPointInsideRing(lng, lat, ring));
};

export const findRegionByLngLat = (
  index: GeoHitIndex | null,
  lat: number,
  lng: number,
): string | null => {
  if (!index || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const normalizedLng = normalizeLongitude(lng);
  for (const region of index.regions) {
    if (isPointInsidePolygon(normalizedLng, lat, region)) return region.name;
  }

  return null;
};

export const vectorToLngLat = (x: number, y: number, z: number) => {
  const radius = Math.hypot(x, y, z);
  if (!Number.isFinite(radius) || radius === 0) return { lng: 0, lat: 0 };

  const clampedY = Math.max(-1, Math.min(1, y / radius));
  const lat = Math.asin(clampedY) * 180 / Math.PI;
  const theta = Math.atan2(z, -x) * 180 / Math.PI;

  return {
    lng: normalizeLongitude(theta - 180),
    lat,
  };
};

export const lngLatToVector = (lng: number, lat: number, radius: number) => {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;

  return {
    x: -radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
};
