import type { StyleSpecification } from 'maplibre-gl';

export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/fiord';

export const RASTER_FALLBACK_STYLE = {
  version: 8,
  sources: {
    cartoDark: {
      type: 'raster',
      tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [
    {
      id: 'carto-dark-raster',
      type: 'raster',
      source: 'cartoDark',
    },
  ],
} satisfies StyleSpecification;
