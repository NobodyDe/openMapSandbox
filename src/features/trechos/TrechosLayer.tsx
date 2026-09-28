import { Layer, Source } from "react-map-gl/maplibre";
import type { FeatureCollection, LineString, MultiLineString } from "geojson";
import type { TrechoFeatureProps } from "./trechoGeoJson";

export const TRECHOS_HIT_LAYER_ID = "trechos-hit";

interface TrechosLayerProps {
  data: FeatureCollection<LineString | MultiLineString, TrechoFeatureProps>;
  hoveredId: string | null;
}

export function TrechosLayer({ data, hoveredId }: TrechosLayerProps) {
  return (
    <Source id="trechos" type="geojson" data={data}>
      <Layer
        id="trechos-linha"
        type="line"
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{ "line-color": ["get", "color"], "line-width": 4 }}
      />
      <Layer
        id="trechos-hover"
        type="line"
        filter={["==", ["get", "id"], hoveredId ?? ""]}
        paint={{ "line-color": "#f59e0b", "line-width": 8 }}
      />
      <Layer
        id={TRECHOS_HIT_LAYER_ID}
        type="line"
        paint={{ "line-color": "#000", "line-width": 16, "line-opacity": 0 }}
      />
    </Source>
  );
}
