import { useMemo } from "react";
import { Layer } from "react-map-gl/maplibre";
import { createGlobeGlowLayer } from "./createGlobeGlowLayer";

// Primeira camada do estilo Liberty: o brilho entra no fundo da pilha, atrás do globo
// (que o cobre por dentro) e abaixo da atmosfera, que o MapLibre sempre desenha por último
const FIRST_STYLE_LAYER_ID = "background";

// export default: é o formato que o React.lazy espera
export default function GlobeGlowLayer() {
  const layer = useMemo(() => createGlobeGlowLayer("globe-glow"), []);
  return <Layer {...layer} beforeId={FIRST_STYLE_LAYER_ID} />;
}
