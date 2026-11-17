import proj4 from "proj4";

const WGS84_DATUM = "+datum=WGS84";
const SIRGAS2000_DATUM = "+ellps=GRS80 +towgs84=0,0,0,0,0,0,0";

function utm(zone: number, south: boolean, datum: string): string {
  return `+proj=utm +zone=${zone}${south ? " +south" : ""} ${datum} +units=m +no_defs`;
}

// Só os UTM usados no Brasil, montados por fórmula. Trocar por uma tabela EPSG completa
// quando aparecer um arquivo com outro CRS
export function epsgToProj4(epsg: number): string | null {
  if (epsg >= 32601 && epsg <= 32660) return utm(epsg - 32600, false, WGS84_DATUM);
  if (epsg >= 32701 && epsg <= 32760) return utm(epsg - 32700, true, WGS84_DATUM);
  if (epsg >= 31965 && epsg <= 31976) return utm(epsg - 31954, false, SIRGAS2000_DATUM);
  if (epsg >= 31977 && epsg <= 31985) return utm(epsg - 31960, true, SIRGAS2000_DATUM);
  return null;
}

// `crs` é uma definição proj4 ou um WKT (o proj4 aceita os dois)
export function projectedToLngLat(crs: string, x: number, y: number): { lng: number; lat: number } {
  const [lng, lat] = proj4(crs, "WGS84", [x, y]);
  return { lng, lat };
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

// Rumo do norte da grade, em graus, horário a partir do norte verdadeiro.
// Projeta (x, y) e (x, y + 100) e mede o rumo entre os dois pontos
export function gridNorthBearing(crs: string, x: number, y: number): number {
  const from = projectedToLngLat(crs, x, y);
  const to = projectedToLngLat(crs, x, y + 100);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const east = Math.sin(deltaLng) * Math.cos(lat2);
  const north = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  return (Math.atan2(east, north) * 180) / Math.PI;
}
