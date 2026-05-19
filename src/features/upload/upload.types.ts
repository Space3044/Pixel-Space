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
}

export interface UploadDimensions {
  width: number;
  height: number;
}
