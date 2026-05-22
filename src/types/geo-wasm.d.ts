declare module '@/assets/wasm/geo/geo_wasm.js' {
  export interface BoundaryPoint {
    x: number;
    y: number;
    z: number;
  }

  export interface BoundaryLine {
    points: BoundaryPoint[];
    region_name: string;
    is_visited: boolean;
  }

  export class GeoProcessor {
    free(): void;
    lat_long_to_vector3(lat: number, lon: number, radius: number): BoundaryPoint & { free?: () => void };
    process_geojson(
      worldData: string,
      chinaData: string,
      visitedPlaces: string,
      scale: number,
    ): void;
    get_boundary_lines(): BoundaryLine[];
    find_nearest_country(x: number, y: number, z: number, radius: number): string | undefined;
  }

  const init: () => Promise<unknown>;
  export default init;
}
