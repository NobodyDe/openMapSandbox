import { feature, length, simplify, truncate } from "@turf/turf";
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  LineString,
  MultiLineString,
  Point,
  Position,
} from "geojson";

// Regras que viviam no frontend (kmzToPoints, kmzToTrechos, kmlAttributes), sem mudança

const DEFAULT_POINT_COLOR = "#dc2626";
const DEFAULT_LINE_COLOR = "#2563eb";
const SIMPLIFY_TOLERANCE_DEG = 0.00001; // ≈ 1 m: o KMZ tem 1 vértice a cada 10 m, até em reta
const COORDINATE_DECIMALS = 6; // ≈ 10 cm; o KMZ traz 13 casas

// Chaves que o togeojson cria a partir do <Style> e do cabeçalho do <Placemark>: não são dados da obra.
// Pontos e linhas vinham de exportações diferentes e tinham listas próprias; ficam as duas
const POINT_META_KEY = /^(name|description|styleUrl|styleHash|styleMapHash)$|^(stroke|fill|icon|label)(-|$)/;
const LINE_META_KEYS = new Set([
  "name",
  "description",
  "styleUrl",
  "stroke",
  "stroke-opacity",
  "stroke-width",
  "fill",
  "fill-opacity",
  "icon",
  "icon-color",
  "icon-opacity",
  "icon-scale",
  "icon-heading",
]);
// Como cada exportação escreve "sem valor": "_" nos pontos, "-" nos trechos
const POINT_EMPTY_VALUES = new Set(["", "_"]);
const LINE_EMPTY_VALUES = new Set(["", "_", "-"]);

function cleanAttributes(
  properties: GeoJsonProperties,
  isMeta: (key: string) => boolean,
  emptyValues: Set<string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(properties ?? {})
      .filter(([key, value]) => !isMeta(key) && !emptyValues.has(String(value)))
      .map(([key, value]) => [key, String(value)]),
  );
}

function colorOf(properties: GeoJsonProperties, fallback: string): string {
  return typeof properties?.stroke === "string" ? properties.stroke : fallback;
}

function toLines(geometry: Geometry | null): Position[][] {
  switch (geometry?.type) {
    case "LineString":
      return [geometry.coordinates];
    case "MultiLineString":
      return geometry.coordinates;
    case "GeometryCollection": // é assim que o togeojson entrega <MultiGeometry> com 2+ linhas
      return geometry.geometries.flatMap(toLines);
    default:
      return [];
  }
}

function toLineGeometry(lines: Position[][]): LineString | MultiLineString {
  return lines.length === 1
    ? { type: "LineString", coordinates: lines[0] }
    : { type: "MultiLineString", coordinates: lines };
}

function simplifyForDisplay(geometry: LineString | MultiLineString): LineString | MultiLineString {
  const simplified = simplify(geometry, { tolerance: SIMPLIFY_TOLERANCE_DEG });
  return truncate(simplified, { precision: COORDINATE_DECIMALS, coordinates: 2 }); // 2 = descarta a altitude
}

function toPointFeature(geometry: Point, properties: GeoJsonProperties): Feature {
  return {
    type: "Feature",
    geometry,
    properties: {
      kind: "point",
      name: String(properties?.name ?? ""),
      color: colorOf(properties, DEFAULT_POINT_COLOR),
      attributes: cleanAttributes(properties, (key) => POINT_META_KEY.test(key), POINT_EMPTY_VALUES),
    },
  };
}

function toLineFeature(lines: Position[][], properties: GeoJsonProperties): Feature {
  const original = toLineGeometry(lines);
  return {
    type: "Feature",
    geometry: simplifyForDisplay(original),
    properties: {
      kind: "line",
      name: String(properties?.name ?? ""),
      color: colorOf(properties, DEFAULT_LINE_COLOR),
      extensaoKm: length(feature(original), { units: "kilometers" }), // medida antes de simplificar
      attributes: cleanAttributes(properties, (key) => LINE_META_KEYS.has(key), LINE_EMPTY_VALUES),
    },
  };
}

// Feição do KML → ponto, linha ou nada (polígonos e outros tipos não são desenhados)
function toLayerFeatures({ geometry, properties }: Feature<Geometry | null>): Feature[] {
  if (geometry?.type === "Point") return [toPointFeature(geometry, properties)];
  const lines = toLines(geometry);
  return lines.length > 0 ? [toLineFeature(lines, properties)] : [];
}

export function kmlToFeatures(collection: FeatureCollection<Geometry | null>): Feature[] {
  return collection.features.flatMap(toLayerFeatures);
}
