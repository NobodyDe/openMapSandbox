import { open } from "node:fs/promises";
import { epsgToProj4, gridNorthBearing, projectedToLngLat } from "./crs.ts";

export interface LasGeoref {
  localOrigin: [number, number, number]; // centro em X e Y, Z mínimo, do cabeçalho
  position?: { lng: number; lat: number }; // ausente se o CRS não foi reconhecido
  bearingDeg?: number;
  unknownEpsg?: number;
}

// Posições do cabeçalho LAS (iguais nas versões 1.2 a 1.4; o .laz tem o mesmo cabeçalho)
const HEADER_SIZE_AT = 94;
const POINT_DATA_OFFSET_AT = 96;
const VLR_COUNT_AT = 100;
const BOX_AT = 179; // maxX, minX, maxY, minY, maxZ, minZ: seis float64
const VLR_HEADER_SIZE = 54;
const GEOKEY_DIRECTORY = 34735;
const WKT_RECORD = 2112;
const PROJECTED_CRS_KEY = 3072; // GeoKey cujo valor é o código EPSG

interface Vlr {
  recordId: number;
  data: DataView;
}

function readLocalOrigin(header: DataView): [number, number, number] {
  const [maxX, minX, maxY, minY, , minZ] = [0, 1, 2, 3, 4, 5].map((i) => header.getFloat64(BOX_AT + i * 8, true));
  return [(minX + maxX) / 2, (minY + maxY) / 2, minZ];
}

// Os VLRs ficam entre o cabeçalho e os pontos: 54 bytes de cabeçalho e depois os dados
function readVlrs(header: DataView): Vlr[] {
  const vlrs: Vlr[] = [];
  let offset = header.getUint16(HEADER_SIZE_AT, true);
  const count = header.getUint32(VLR_COUNT_AT, true);
  for (let i = 0; i < count && offset + VLR_HEADER_SIZE <= header.byteLength; i++) {
    const recordId = header.getUint16(offset + 18, true);
    const length = header.getUint16(offset + 20, true);
    const start = offset + VLR_HEADER_SIZE;
    const available = Math.min(length, header.byteLength - start);
    vlrs.push({ recordId, data: new DataView(header.buffer, start, available) });
    offset = start + length;
  }
  return vlrs;
}

// GeoKeys: 4 uint16 de cabeçalho (o 4º é o número de chaves) e 4 uint16 por chave:
// id, onde está o valor (0 = no próprio campo), quantidade, valor
function readEpsg(geoKeys: DataView): number | undefined {
  const keyCount = geoKeys.getUint16(6, true);
  for (let key = 1; key <= keyCount && (key + 1) * 8 <= geoKeys.byteLength; key++) {
    const at = key * 8;
    const isProjectedCrs = geoKeys.getUint16(at, true) === PROJECTED_CRS_KEY;
    if (isProjectedCrs && geoKeys.getUint16(at + 2, true) === 0) return geoKeys.getUint16(at + 6, true);
  }
  return undefined;
}

// EPSG conhecido primeiro; senão o WKT do arquivo, que o proj4 lê direto
function findCrs(vlrs: Vlr[]): { crs?: string; epsg?: number } {
  const geoKeys = vlrs.find((vlr) => vlr.recordId === GEOKEY_DIRECTORY);
  const epsg = geoKeys && readEpsg(geoKeys.data);
  const fromEpsg = epsg === undefined ? null : epsgToProj4(epsg);
  if (fromEpsg) return { crs: fromEpsg, epsg };
  const wkt = vlrs.find((vlr) => vlr.recordId === WKT_RECORD);
  return { crs: wkt && new TextDecoder().decode(wkt.data).replace(/\0+$/, ""), epsg };
}

// Uint8Array novo, e não um Buffer do pool: readVlrs conta os offsets a partir do início do ArrayBuffer
async function readFileStart(path: string, length: number): Promise<DataView> {
  const file = await open(path);
  try {
    const bytes = new Uint8Array(length);
    await file.read(bytes, 0, length, 0);
    return new DataView(bytes.buffer);
  } finally {
    await file.close();
  }
}

// Lê só o cabeçalho e os VLRs (alguns KB), nunca os pontos
export async function readLasGeoref(path: string): Promise<LasGeoref> {
  const start = await readFileStart(path, POINT_DATA_OFFSET_AT + 4);
  const header = await readFileStart(path, start.getUint32(POINT_DATA_OFFSET_AT, true));
  const localOrigin = readLocalOrigin(header);
  const { crs, epsg } = findCrs(readVlrs(header));
  if (!crs) return { localOrigin, unknownEpsg: epsg };
  const [x, y] = localOrigin;
  try {
    return { localOrigin, position: projectedToLngLat(crs, x, y), bearingDeg: gridNorthBearing(crs, x, y) };
  } catch {
    return { localOrigin, unknownEpsg: epsg }; // WKT que o proj4 não entende
  }
}
