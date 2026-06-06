import type { Map as MaplibreMap, Marker as MaplibreMarker, StyleSpecification } from 'maplibre-gl';

// 海外足迹页交互地图用 Mapbox 栅格瓦片（dark-v11），和 global 静态图同源同风格。
// 坐标全程 WGS-84，无需 GCJ-02 偏移，marker 与底图天然对齐，海外街道也准。

const MAPBOX_STYLE_ID = 'mapbox/dark-v11';

let tokenPromise: Promise<string> | null = null;
let maplibrePromise: Promise<MaplibreNamespace> | null = null;

export type MaplibreNamespace = typeof import('maplibre-gl');

const readMapboxToken = async (): Promise<string> => {
  const response = await fetch('/api/mapbox-config', {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error('mapbox_config_failed');

  const data = (await response.json()) as { token?: string };
  if (!data.token) throw new Error('mapbox_token_missing');

  return data.token;
};

export const loadMapboxToken = (): Promise<string> => {
  tokenPromise ??= readMapboxToken();
  return tokenPromise;
};

export const loadMaplibre = (): Promise<MaplibreNamespace> => {
  maplibrePromise ??= Promise.all([
    import('maplibre-gl'),
    import('maplibre-gl/dist/maplibre-gl.css'),
  ]).then(([maplibre]) => maplibre);
  return maplibrePromise;
};

// dark-v11 栅格瓦片，512 尺寸不加 @2x。单瓦片约 80KB，比 @2x 的 350KB 小四倍多。
// 国内到 Mapbox 海外服务器带宽有限，瓦片体积是加载速度的主要瓶颈，故优先压体积。
// 占位符 {z}/{x}/{y} 不能 encode，token 单独编码。
export const mapboxRasterStyle = (token: string): StyleSpecification => ({
  version: 8,
  sources: {
    'mapbox-dark': {
      type: 'raster',
      tiles: [
        `https://api.mapbox.com/styles/v1/${MAPBOX_STYLE_ID}/tiles/512/{z}/{x}/{y}?access_token=${encodeURIComponent(token)}`,
      ],
      tileSize: 512,
      attribution:
        '© <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    },
  },
  layers: [
    {
      id: 'mapbox-dark',
      type: 'raster',
      source: 'mapbox-dark',
    },
  ],
});

export type { MaplibreMap, MaplibreMarker };
