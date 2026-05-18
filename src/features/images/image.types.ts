export interface ImageRecord {
  key: string;
  title: string;
  caption: string | null;
  public_url: string;
  width: number;
  height: number;
  format: string;
  location_name: string | null;
}
