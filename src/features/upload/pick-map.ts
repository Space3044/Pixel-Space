import { loadAmap } from './amap';
import type { AMapClickEvent, AMapMap, AMapMarker, AMapNamespace } from './amap';
import { loadMapboxToken, loadMaplibre, mapboxRasterStyle } from '@/features/footprints/mapbox';
import type { MaplibreMap, MaplibreMarker, MaplibreNamespace } from '@/features/footprints/mapbox';
import { mapLngLatFromStored, storedLngLatFromMap } from './map-coordinate';
import type { LngLat } from './map-coordinate';

// 上传页取景地图与足迹页同源：国内高德 grey（GCJ-02 显示），国外 Mapbox dark（WGS-84 直用）。
// 点选交互（点地图落点 + 单个标记）收敛到 adapter，坐标对外一律 WGS-84。

export interface PickMapAdapter {
  init(container: HTMLElement, onReady: () => void, onPick: (stored: LngLat) => void): Promise<void>;
  setMarker(stored: LngLat | null, center: boolean): void;
  resize(): void;
  destroy(): void;
}

const PICK_FOCUS_ZOOM = 13;
const round6 = (value: number): number => Number(value.toFixed(6));

const createPinElement = (): HTMLSpanElement => {
  const element = document.createElement('span');
  element.className = 'map-marker map-location-pin';
  element.setAttribute('aria-hidden', 'true');
  const dot = document.createElement('span');
  dot.className = 'map-location-pin-dot';
  element.appendChild(dot);
  return element;
};

const CHINA_DEFAULT: LngLat = { lng: 121.4737, lat: 31.2304 };
const CHINA_FLAT_ZOOM = 9;

// 高德 adapter：grey 个性化样式，点选坐标 GCJ→WGS 落库。
export const createChinaPickAdapter = (): PickMapAdapter => {
  let map: AMapMap | null = null;
  let amap: AMapNamespace | null = null;
  let marker: AMapMarker | null = null;
  let disposed = false;

  return {
    async init(container, onReady, onPick) {
      amap = await loadAmap();
      if (disposed || map) return;
      const center = mapLngLatFromStored(CHINA_DEFAULT);
      map = new amap.Map(container, {
        center: [center.lng, center.lat],
        zoom: CHINA_FLAT_ZOOM,
        lang: 'zh_cn',
        viewMode: '2D',
        resizeEnable: true,
        mapStyle: 'amap://styles/grey',
      });
      map.addControl(new amap.ToolBar({ position: 'RT' }));
      map.addControl(new amap.Scale());
      map.on('click', (event: AMapClickEvent) => {
        const stored = storedLngLatFromMap({ lng: event.lnglat.getLng(), lat: event.lnglat.getLat() });
        onPick({ lng: round6(stored.lng), lat: round6(stored.lat) });
      });
      onReady();
    },
    setMarker(stored, center) {
      if (!map || !amap) return;
      if (!stored) {
        marker?.setMap(null);
        marker = null;
        return;
      }
      const display = mapLngLatFromStored(stored);
      const position: [number, number] = [display.lng, display.lat];
      if (!marker) {
        marker = new amap.Marker({ position, content: createPinElement(), anchor: 'bottom-center' });
        marker.setMap(map);
      } else {
        marker.setPosition(position);
      }
      if (center) map.setZoomAndCenter(PICK_FOCUS_ZOOM, position);
    },
    resize() {
      map?.resize?.();
    },
    destroy() {
      disposed = true;
      marker?.setMap(null);
      marker = null;
      map?.destroy();
      map = null;
      amap = null;
    },
  };
};

const WORLD_DEFAULT: LngLat = { lng: 10, lat: 25 };
const WORLD_FLAT_ZOOM = 1.4;

// Mapbox adapter：MapLibre + dark-v11 栅格，点选坐标即 WGS-84，无需偏移转换。
export const createWorldPickAdapter = (): PickMapAdapter => {
  let map: MaplibreMap | null = null;
  let marker: MaplibreMarker | null = null;
  let maplibre: MaplibreNamespace | null = null;
  let disposed = false;

  return {
    async init(container, onReady, onPick) {
      const token = await loadMapboxToken();
      const maplibregl = await loadMaplibre();
      if (disposed || map) return;
      maplibre = maplibregl;
      map = new maplibregl.Map({
        container,
        style: mapboxRasterStyle(token),
        center: [WORLD_DEFAULT.lng, WORLD_DEFAULT.lat],
        zoom: WORLD_FLAT_ZOOM,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
      });
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new maplibregl.ScaleControl(), 'bottom-left');
      map.on('click', (event) => {
        onPick({ lng: round6(event.lngLat.lng), lat: round6(event.lngLat.lat) });
      });
      map.on('load', onReady);
    },
    setMarker(stored, center) {
      if (!map) return;
      if (!stored) {
        marker?.remove();
        marker = null;
        return;
      }
      const position: [number, number] = [stored.lng, stored.lat];
      if (!marker) {
        if (!maplibre) return;
        marker = new maplibre.Marker({ element: createPinElement(), anchor: 'bottom' })
          .setLngLat(position)
          .addTo(map);
      } else {
        marker.setLngLat(position);
      }
      if (center) map.flyTo({ center: position, zoom: PICK_FOCUS_ZOOM });
    },
    resize() {
      map?.resize();
    },
    destroy() {
      disposed = true;
      marker?.remove();
      marker = null;
      map?.remove();
      map = null;
      maplibre = null;
    },
  };
};
