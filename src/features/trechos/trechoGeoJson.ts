import type { FeatureCollection, LineString, MultiLineString } from "geojson";
import type { Trecho } from "./types";

export interface TrechoFeatureProps {
  id: string;
  color: string;
}

// Só id + cor vão para o MapLibre; os atributos ficam no React e o popup busca pelo id
export function trechosToFeatureCollection(
  trechos: Trecho[],
): FeatureCollection<LineString | MultiLineString, TrechoFeatureProps> {
  return {
    type: "FeatureCollection",
    features: trechos.map(({ id, color, geometry }) => ({
      type: "Feature",
      properties: { id, color },
      geometry,
    })),
  };
}
