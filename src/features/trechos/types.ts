import type { LineString, MultiLineString } from "geojson";

export interface Trecho {
  id: string;
  name: string;
  color: string;
  extensaoKm: number; // medida na geometria ORIGINAL, antes de simplificar
  attributes: Record<string, string>;
  geometry: LineString | MultiLineString; // já simplificada, só para desenhar
}
