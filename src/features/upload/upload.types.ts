import type { MapRegion } from './map-coordinate';

export interface UploadExif {
  taken_at: string | null;
  camera: string | null;
  iso: number | null;
  aperture: number | null;
  shutter: string | null;
  focal_length: number | null;
  location_lat: number | null;
  location_lng: number | null;
}

export interface UploadMeta {
  title: string;
  caption: string;
  location_name: string;
  location_lat: number | null;
  location_lng: number | null;
  location_region: MapRegion | null;
  tags: string;
  search_content: string;
  dominant_color: string;
  palette: string;
  composition: string;
  ai_status: 'pending' | 'done' | 'failed';
  is_public: 0 | 1;
  location_public: 0 | 1;
  folder_id: string | null;
}

export interface UploadDimensions {
  width: number;
  height: number;
}
