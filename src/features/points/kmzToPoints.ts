import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  Point,
} from "geojson";
import type { MapPoint } from "./types";

const DEFAULT_COLOR = "#dc2626";
// Chaves que o togeojson cria a partir do <Style> e do cabeçalho do <Placemark>: não são dados da obra
const KML_META_KEY =
  /^(name|description|styleUrl|styleHash|styleMapHash)$|^(stroke|fill|icon|label)(-|$)/;
const EMPTY_VALUES = new Set(["", "_"]); // "_" é como o sistema de origem exporta "sem valor"

function isPointFeature(
  feature: Feature<Geometry | null>,
): feature is Feature<Point> {
  return feature.geometry?.type === "Point";
}

function extractAttributes(
  properties: GeoJsonProperties,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(properties ?? {})
      .filter(
        ([key, value]) =>
          !KML_META_KEY.test(key) && !EMPTY_VALUES.has(String(value)),
      )
      .map(([key, value]) => [key, String(value)]),
  );
}

function featureToPoint(feature: Feature<Point>, index: number): MapPoint {
  const [lng, lat] = feature.geometry.coordinates;
  const properties = feature.properties ?? {};
  return {
    id: String(feature.id ?? index),
    name: String(properties.name ?? ""),
    lng,
    lat,
    color:
      typeof properties.stroke === "string" ? properties.stroke : DEFAULT_COLOR,
    attributes: extractAttributes(properties),
  };
}

export function featuresToPoints(
  collection: FeatureCollection<Geometry | null>,
): MapPoint[] {
  return collection.features.filter(isPointFeature).map(featureToPoint);
}
