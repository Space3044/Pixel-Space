export const AMAP_LOADER_URL = 'https://webapi.amap.com/loader.js';

const AMAP_PLUGINS = ['AMap.ToolBar', 'AMap.Scale', 'AMap.PlaceSearch', 'AMap.Geocoder'] as const;

interface AmapConfig {
  key: string;
  securityJsCode: string;
}

export interface AMapLngLat {
  getLng(): number;
  getLat(): number;
}

export interface AMapClickEvent {
  lnglat: AMapLngLat;
}

export type AMapPosition = [number, number];

export interface AMapMap {
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
  addControl(control: unknown): void;
  destroy(): void;
  getCenter(): AMapLngLat;
  getZoom(): number;
  getZooms?(): [number, number];
  setCenter(center: AMapPosition): void;
  setZoom(zoom: number): void;
  setZoomAndCenter(zoom: number, center: AMapPosition): void;
  setFitView?(overlays: unknown[], immediately?: boolean, avoid?: [number, number, number, number], maxZoom?: number): void;
  setStatus?(status: Record<string, boolean>): void;
  resize?(): void;
}

export interface AMapMarker {
  setMap(map: AMapMap | null): void;
  setPosition(position: AMapPosition): void;
}

export type AMapSearchStatus = 'complete' | 'error' | 'no_data' | string;

export interface AMapPlaceSearch {
  search(keyword: string, callback: (status: AMapSearchStatus, result: unknown) => void): void;
}

export interface AMapGeocoder {
  getLocation(address: string, callback: (status: AMapSearchStatus, result: unknown) => void): void;
  getAddress(location: AMapPosition | AMapLngLat, callback: (status: AMapSearchStatus, result: unknown) => void): void;
}

export interface AMapNamespace {
  Map: new (container: HTMLElement, options: Record<string, unknown>) => AMapMap;
  Marker: new (options: Record<string, unknown>) => AMapMarker;
  Scale: new (options?: Record<string, unknown>) => unknown;
  ToolBar: new (options?: Record<string, unknown>) => unknown;
  PlaceSearch: new (options?: Record<string, unknown>) => AMapPlaceSearch;
  Geocoder: new (options?: Record<string, unknown>) => AMapGeocoder;
}

interface AMapLoader {
  load(options: {
    key: string;
    version: '2.0';
    lang: 'zh_cn';
    plugins: readonly string[];
  }): Promise<AMapNamespace>;
}

declare global {
  interface Window {
    AMapLoader?: AMapLoader;
    _AMapSecurityConfig?: {
      securityJsCode: string;
    };
  }
}

let loaderScriptPromise: Promise<void> | null = null;
let amapPromise: Promise<AMapNamespace> | null = null;

const readAmapConfig = async (): Promise<AmapConfig> => {
  const response = await fetch('/api/amap-config', {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error('amap_config_failed');

  const data = (await response.json()) as Partial<AmapConfig>;
  if (!data.key) throw new Error('amap_key_missing');

  return {
    key: data.key,
    securityJsCode: data.securityJsCode ?? '',
  };
};

const loadAmapLoaderScript = (): Promise<void> => {
  if (window.AMapLoader) return Promise.resolve();
  if (loaderScriptPromise) return loaderScriptPromise;

  loaderScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = AMAP_LOADER_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('amap_loader_failed'));
    document.head.appendChild(script);
  });

  return loaderScriptPromise;
};

export const loadAmap = (): Promise<AMapNamespace> => {
  amapPromise ??= (async () => {
    const config = await readAmapConfig();
    if (config.securityJsCode) {
      window._AMapSecurityConfig = { securityJsCode: config.securityJsCode };
    }

    await loadAmapLoaderScript();
    if (!window.AMapLoader) throw new Error('amap_loader_missing');

    return window.AMapLoader.load({
      key: config.key,
      version: '2.0',
      lang: 'zh_cn',
      plugins: AMAP_PLUGINS,
    });
  })();

  return amapPromise;
};
