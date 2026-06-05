export type LocationRegion = 'china' | 'global';

export interface LngLat {
  lng: number;
  lat: number;
}

const CHINA_BOUNDS = {
  minLng: 72.004,
  maxLng: 137.8347,
  minLat: 0.8293,
  maxLat: 55.8271,
};

export const regionForCoordinate = (coordinate: LngLat | null | undefined): LocationRegion | null => {
  if (!coordinate) return null;
  const outside =
    coordinate.lng < CHINA_BOUNDS.minLng ||
    coordinate.lng > CHINA_BOUNDS.maxLng ||
    coordinate.lat < CHINA_BOUNDS.minLat ||
    coordinate.lat > CHINA_BOUNDS.maxLat;
  return outside ? 'global' : 'china';
};
