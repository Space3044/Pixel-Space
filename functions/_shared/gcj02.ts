// 服务端坐标转换：与前端 src/features/upload/map-coordinate.ts 同源算法。
// 跨 src/functions 直接引用会耦合前端目录与构建，这里只取静态地图代理需要的
// wgs84ToGcj02，把存储的 WGS84 坐标转成高德要求的 GCJ-02。

export interface LngLat {
  lng: number;
  lat: number;
}

const GCJ_A = 6378245;
const GCJ_EE = 0.006693421622965943;
const PI = Math.PI;

const isOutsideChina = (lng: number, lat: number): boolean =>
  lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;

const transformLat = (lng: number, lat: number): number => {
  let ret = -100 + 2 * lng + 3 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
  ret += ((20 * Math.sin(6 * lng * PI) + 20 * Math.sin(2 * lng * PI)) * 2) / 3;
  ret += ((20 * Math.sin(lat * PI) + 40 * Math.sin((lat / 3) * PI)) * 2) / 3;
  ret += ((160 * Math.sin((lat / 12) * PI) + 320 * Math.sin((lat * PI) / 30)) * 2) / 3;
  return ret;
};

const transformLng = (lng: number, lat: number): number => {
  let ret = 300 + lng + 2 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
  ret += ((20 * Math.sin(6 * lng * PI) + 20 * Math.sin(2 * lng * PI)) * 2) / 3;
  ret += ((20 * Math.sin(lng * PI) + 40 * Math.sin((lng / 3) * PI)) * 2) / 3;
  ret += ((150 * Math.sin((lng / 12) * PI) + 300 * Math.sin((lng / 30) * PI)) * 2) / 3;
  return ret;
};

export const wgs84ToGcj02 = (lng: number, lat: number): LngLat => {
  if (isOutsideChina(lng, lat)) return { lng, lat };

  let dLat = transformLat(lng - 105, lat - 35);
  let dLng = transformLng(lng - 105, lat - 35);
  const radLat = (lat / 180) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - GCJ_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180) / (((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180) / ((GCJ_A / sqrtMagic) * Math.cos(radLat) * PI);

  return {
    lng: lng + dLng,
    lat: lat + dLat,
  };
};
