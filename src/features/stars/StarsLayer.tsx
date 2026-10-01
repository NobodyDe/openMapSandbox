import { useMemo } from "react";
import { Layer } from "react-map-gl/maplibre";
import { createStarsLayer } from "./createStarsLayer";

// Primeira camada do estilo Liberty: as estrelas entram ABAIXO dela, ou seja,
// atrás de tudo (globo, satélite, rótulos, atmosfera)
const FIRST_STYLE_LAYER_ID = "background";

// export default: é o formato que o React.lazy espera
export default function StarsLayer() {
  const layer = useMemo(() => createStarsLayer("stars"), []);
  return <Layer {...layer} beforeId={FIRST_STYLE_LAYER_ID} />;
}
