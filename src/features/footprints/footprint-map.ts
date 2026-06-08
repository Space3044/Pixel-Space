import { loadAmap } from '@/features/upload/amap';
import type { AMapMap, AMapMarker, AMapNamespace } from '@/features/upload/amap';
import { mapLngLatFromStored } from '@/features/upload/map-coordinate';
import { loadMapboxToken, loadMaplibre, mapboxRasterStyle } from './mapbox';
import type { MaplibreMap, MaplibreMarker, MaplibreNamespace } from './mapbox';

// 两张足迹平面图共用一套交互（标点、选中、缩放滑块），地图源差异收敛到 adapter：
// 高德管国内（GCJ-02、国内访问快、暗色 grey），Mapbox 管世界（WGS-84、海外详细）。
// 坐标对外一律用存储的 WGS-84，转换在 adapter 内部完成。

export interface FootprintPoint {
  lng: number;
  lat: number;
}

export interface FootprintScreenPoint {
  x: number;
  y: number;
}

export interface FootprintMapAdapter {
  readonly zoomMin: number;
  readonly zoomMax: number;
  init(container: HTMLElement, onReady: () => void, onZoom: (zoom: number) => void): Promise<void>;
  placeMarker(key: string, lng: number, lat: number, element: HTMLElement): void;
  removeMarker(key: string): void;
  project(lng: number, lat: number): FootprintScreenPoint | null;
  focus(lng: number, lat: number, zoom?: number): void;
  fitAll(points: FootprintPoint[]): void;
  setZoom(zoom: number): void;
  getZoom(): number;
  destroy(): void;
}

const CHINA_CENTER = mapLngLatFromStored({ lng: 104.1954, lat: 35.8617 });
const CHINA_ZOOM_MIN = 3;
const CHINA_ZOOM_MAX = 18;
const CHINA_FLAT_ZOOM = 3;
const CHINA_FOCUS_ZOOM = 12;

// 高德 adapter：个性化样式 grey（控制台需对该 key 开通自定义地图，未开通会回退默认底色）。
export const createChinaAdapter = (): FootprintMapAdapter => {
  let map: AMapMap | null = null;
  let amap: AMapNamespace | null = null;
  const markers = new Map<string, AMapMarker>();

  const focus = (lng: number, lat: number, zoom = CHINA_FOCUS_ZOOM) => {
    if (!map) return;
    const c = mapLngLatFromStored({ lng, lat });
    map.setZoomAndCenter(Math.max(map.getZoom(), zoom), [c.lng, c.lat]);
  };

  return {
    zoomMin: CHINA_ZOOM_MIN,
    zoomMax: CHINA_ZOOM_MAX,
    async init(container, onReady, onZoom) {
      amap = await loadAmap();
      if (map) return;
      map = new amap.Map(container, {
        center: [CHINA_CENTER.lng, CHINA_CENTER.lat],
        zoom: CHINA_FLAT_ZOOM,
        lang: 'zh_cn',
        viewMode: '2D',
        resizeEnable: true,
        zooms: [CHINA_ZOOM_MIN, CHINA_ZOOM_MAX],
        mapStyle: 'amap://styles/grey',
      });
      map.addControl(new amap.Scale());
      map.on('zoomchange', () => {
        if (map) onZoom(map.getZoom());
      });
      onReady();
    },
    placeMarker(key, lng, lat, element) {
      if (!map || !amap) return;
      const c = mapLngLatFromStored({ lng, lat });
      const position: [number, number] = [c.lng, c.lat];
      const existing = markers.get(key);
      if (existing) {
        existing.setPosition(position);
        return;
      }
      const marker = new amap.Marker({ position, content: element, anchor: 'center' });
      marker.setMap(map);
      markers.set(key, marker);
    },
    removeMarker(key) {
      markers.get(key)?.setMap(null);
      markers.delete(key);
    },
    project(lng, lat) {
      if (!map?.lngLatToContainer) return null;
      const c = mapLngLatFromStored({ lng, lat });
      const point = map.lngLatToContainer([c.lng, c.lat]);
      return { x: point.getX(), y: point.getY() };
    },
    focus,
    fitAll(points) {
      if (!map) return;
      if (points.length === 0) {
        map.setCenter([CHINA_CENTER.lng, CHINA_CENTER.lat]);
        map.setZoom(CHINA_FLAT_ZOOM);
        return;
      }
      if (points.length === 1) {
        focus(points[0].lng, points[0].lat);
        return;
      }
      map.setFitView?.([...markers.values()], false, [80, 80, 80, 80], 9);
    },
    setZoom(zoom) {
      map?.setZoom(zoom);
    },
    getZoom() {
      return map?.getZoom() ?? CHINA_FLAT_ZOOM;
    },
    destroy() {
      for (const marker of markers.values()) marker.setMap(null);
      markers.clear();
      map?.destroy();
      map = null;
      amap = null;
    },
  };
};

const WORLD_CENTER = { lng: 10, lat: 25 };
const WORLD_ZOOM_MIN = 1;
const WORLD_ZOOM_MAX = 18;
const WORLD_FLAT_ZOOM = 1.4;
const WORLD_FOCUS_ZOOM = 10;

// Mapbox adapter：MapLibre + dark-v11 栅格，WGS-84 直接用，marker 自动跟随地图。
export const createWorldAdapter = (): FootprintMapAdapter => {
  let map: MaplibreMap | null = null;
  let maplibre: MaplibreNamespace | null = null;
  const markers = new Map<string, MaplibreMarker>();

  const focus = (lng: number, lat: number, zoom = WORLD_FOCUS_ZOOM) => {
    if (!map) return;
    map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), zoom) });
  };

  return {
    zoomMin: WORLD_ZOOM_MIN,
    zoomMax: WORLD_ZOOM_MAX,
    async init(container, onReady, onZoom) {
      const token = await loadMapboxToken();
      const maplibregl = await loadMaplibre();
      if (map) return;
      maplibre = maplibregl;
      map = new maplibregl.Map({
        container,
        style: mapboxRasterStyle(token),
        center: [WORLD_CENTER.lng, WORLD_CENTER.lat],
        zoom: WORLD_FLAT_ZOOM,
        minZoom: WORLD_ZOOM_MIN,
        maxZoom: WORLD_ZOOM_MAX,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
      });
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
      map.addControl(new maplibregl.ScaleControl(), 'bottom-left');
      map.on('zoom', () => {
        if (map) onZoom(map.getZoom());
      });
      map.on('load', onReady);
    },
    placeMarker(key, lng, lat, element) {
      if (!map) return;
      const existing = markers.get(key);
      if (existing) {
        existing.setLngLat([lng, lat]);
        return;
      }
      if (!maplibre) return;
      const marker = new maplibre.Marker({ element, anchor: 'center' }).setLngLat([lng, lat]).addTo(map);
      markers.set(key, marker);
    },
    removeMarker(key) {
      markers.get(key)?.remove();
      markers.delete(key);
    },
    project(lng, lat) {
      if (!map) return null;
      const point = map.project([lng, lat]);
      return { x: point.x, y: point.y };
    },
    focus,
    fitAll(points) {
      if (!map) return;
      if (points.length === 0) {
        map.setCenter([WORLD_CENTER.lng, WORLD_CENTER.lat]);
        map.setZoom(WORLD_FLAT_ZOOM);
        return;
      }
      if (points.length === 1) {
        focus(points[0].lng, points[0].lat);
        return;
      }
      if (!maplibre) return;
      const bounds = new maplibre.LngLatBounds();
      for (const point of points) bounds.extend([point.lng, point.lat]);
      map.fitBounds(bounds, { padding: 64, maxZoom: 9 });
    },
    setZoom(zoom) {
      map?.setZoom(zoom);
    },
    getZoom() {
      return map?.getZoom() ?? WORLD_FLAT_ZOOM;
    },
    destroy() {
      for (const marker of markers.values()) marker.remove();
      markers.clear();
      map?.remove();
      map = null;
      maplibre = null;
    },
  };
};
