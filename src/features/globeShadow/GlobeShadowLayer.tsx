import { useMemo } from "react";
import { Layer } from "react-map-gl/maplibre";
import { createGlobeShadowLayer } from "./createGlobeShadowLayer";

// Primeira camada de rótulos do Liberty (a mesma do SatelliteLayer): a sombra fica
// acima do satélite e abaixo dos nomes, que continuam legíveis no lado escuro
const FIRST_LABEL_LAYER_ID = "waterway_line_label";

// export default: é o formato que o React.lazy espera
export default function GlobeShadowLayer() {
  const layer = useMemo(() => createGlobeShadowLayer("globe-shadow"), []);
  return <Layer {...layer} beforeId={FIRST_LABEL_LAYER_ID} />;
}
