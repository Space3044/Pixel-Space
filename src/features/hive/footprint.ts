import type { ImageRecord } from '@/features/images/image.types';
import { mapRegionForStoredCoordinate, type MapRegion } from '@/features/upload/map-coordinate';

// 足迹页的点位分组：同一地点（同名 + 同四位小数坐标）的图聚成一组。
// region 优先取图自带的 location_region，缺省时按坐标兜底，决定它落在高德图还是 Mapbox 图。

export interface FootprintGroup {
  key: string;
  name: string;
  lat: number;
  lng: number;
  region: MapRegion;
  cover: ImageRecord;
  images: ImageRecord[];
}

interface LocatedImage extends ImageRecord {
  location_lat: number;
  location_lng: number;
}

const isLocatedImage = (image: ImageRecord): image is LocatedImage =>
  image.location_lat !== null && image.location_lng !== null
  && Number.isFinite(image.location_lat) && Number.isFinite(image.location_lng);

const coordinateLabel = (lat: number, lng: number) => `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

const regionOf = (image: LocatedImage): MapRegion =>
  image.location_region === 'china' || image.location_region === 'global'
    ? image.location_region
    : mapRegionForStoredCoordinate({ lng: image.location_lng, lat: image.location_lat });

export const groupFootprints = (images: ImageRecord[]): FootprintGroup[] => {
  const groups = new Map<string, FootprintGroup>();

  for (const image of images) {
    if (!isLocatedImage(image)) continue;
    const name = image.location_name?.trim() || coordinateLabel(image.location_lat, image.location_lng);
    const key = `${name}|${image.location_lat.toFixed(4)}|${image.location_lng.toFixed(4)}`;
    let group = groups.get(key);

    if (!group) {
      group = {
        key,
        name,
        lat: image.location_lat,
        lng: image.location_lng,
        region: regionOf(image),
        cover: image,
        images: [],
      };
      groups.set(key, group);
    }

    group.images.push(image);
    if (!group.cover.caption && image.caption) group.cover = image;
  }

  return [...groups.values()].sort((a, b) =>
    b.images.length - a.images.length || a.name.localeCompare(b.name, 'zh-CN'),
  );
};
