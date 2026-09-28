import { feature, length, simplify, truncate } from "@turf/turf";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  MultiLineString,
  Position,
} from "geojson";
import { extractAttributes } from "../../lib/kmlAttributes";
import type { Trecho } from "./types";

const DEFAULT_COLOR = "#2563eb";
const SIMPLIFY_TOLERANCE_DEG = 0.00001; // ≈ 1 m: o KMZ tem 1 vértice a cada 10 m, até em reta
const COORDINATE_DECIMALS = 6; // ≈ 10 cm; o KMZ traz 13 casas

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

function simplifyForDisplay(geometry: LineString | MultiLineString) {
  const simplified = simplify(geometry, { tolerance: SIMPLIFY_TOLERANCE_DEG });
  return truncate(simplified, {
    precision: COORDINATE_DECIMALS,
    coordinates: 2,
  }); // 2 = descarta a altitude
}

function featureToTrecho(
  kmlFeature: Feature<Geometry | null>,
  index: number,
): Trecho | null {
  const lines = toLines(kmlFeature.geometry);
  if (lines.length === 0) return null;

  const original = toLineGeometry(lines);
  const properties = kmlFeature.properties ?? {};
  return {
    id: String(kmlFeature.id ?? index),
    name: String(properties.name ?? ""),
    color:
      typeof properties.stroke === "string" ? properties.stroke : DEFAULT_COLOR,
    extensaoKm: length(feature(original), { units: "kilometers" }),
    attributes: extractAttributes(properties),
    geometry: simplifyForDisplay(original),
  };
}

export function featuresToTrechos(
  collection: FeatureCollection<Geometry | null>,
): Trecho[] {
  return collection.features
    .map(featureToTrecho)
    .filter((trecho): trecho is Trecho => trecho !== null);
}
