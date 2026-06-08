export interface ProjectedFootprintMarker {
  key: string;
  name: string;
  lng: number;
  lat: number;
  x: number;
  y: number;
  imagesCount: number;
}

export interface MarkerClusterOptions {
  radius?: number;
}

export interface FootprintMarkerCluster {
  id: string;
  kind: 'single' | 'cluster';
  points: ProjectedFootprintMarker[];
  lng: number;
  lat: number;
  x: number;
  y: number;
  imagesCount: number;
}

export interface SpiderfyOptions {
  radius?: number;
}

export interface SpiderfyOffset {
  x: number;
  y: number;
}

const DEFAULT_CLUSTER_RADIUS = 44;
const DEFAULT_SPIDERFY_RADIUS = 34;

const distance = (a: Pick<ProjectedFootprintMarker, 'x' | 'y'>, b: Pick<ProjectedFootprintMarker, 'x' | 'y'>) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

const roundOffset = (value: number) => {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
};

const buildCluster = (points: ProjectedFootprintMarker[]): FootprintMarkerCluster => {
  const id = points.length === 1 ? points[0].key : `cluster:${points.map((point) => point.key).join('|')}`;

  return {
    id,
    kind: points.length === 1 ? 'single' : 'cluster',
    points,
    lng: average(points.map((point) => point.lng)),
    lat: average(points.map((point) => point.lat)),
    x: average(points.map((point) => point.x)),
    y: average(points.map((point) => point.y)),
    imagesCount: points.reduce((sum, point) => sum + point.imagesCount, 0),
  };
};

export const clusterProjectedMarkers = (
  points: ProjectedFootprintMarker[],
  options: MarkerClusterOptions = {},
): FootprintMarkerCluster[] => {
  const radius = options.radius ?? DEFAULT_CLUSTER_RADIUS;
  const visited = new Set<string>();
  const clusters: FootprintMarkerCluster[] = [];

  for (const seed of points) {
    if (visited.has(seed.key)) continue;

    const members: ProjectedFootprintMarker[] = [seed];
    visited.add(seed.key);

    let center = { x: seed.x, y: seed.y };
    let changed = true;

    while (changed) {
      changed = false;

      for (const candidate of points) {
        if (visited.has(candidate.key)) continue;
        if (distance(candidate, center) > radius) continue;

        members.push(candidate);
        visited.add(candidate.key);
        center = {
          x: average(members.map((point) => point.x)),
          y: average(members.map((point) => point.y)),
        };
        changed = true;
      }
    }

    clusters.push(buildCluster(members));
  }

  return clusters;
};

export const createSpiderfyOffsets = (count: number, options: SpiderfyOptions = {}): SpiderfyOffset[] => {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 0, y: 0 }];

  const radius = options.radius ?? Math.min(58, DEFAULT_SPIDERFY_RADIUS + count * 2);

  return Array.from({ length: count }, (_, index) => {
    if (count > 10) {
      const angle = index * 0.72;
      const spiralRadius = radius + index * 2.8;
      return {
        x: roundOffset(Math.cos(angle) * spiralRadius),
        y: roundOffset(Math.sin(angle) * spiralRadius),
      };
    }

    const angle = (index / count) * Math.PI * 2;
    return {
      x: roundOffset(Math.cos(angle) * radius),
      y: roundOffset(Math.sin(angle) * radius),
    };
  });
};
