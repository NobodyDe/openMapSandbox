import { Layer, Source } from "react-map-gl/maplibre";

// Esri World Imagery — a mesma fonte do projeto Orion. Atenção: a ordem é {y}/{x}
const SATELLITE_TILES = [
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
];
const SATELLITE_MAX_ZOOM = 18; // acima disso o MapLibre amplia os tiles do 18 em vez de pedir tiles inexistentes
// Primeira camada de rótulos do estilo Liberty: o satélite entra logo abaixo,
// então nomes de cidades e placas de rodovia continuam visíveis por cima da imagem
const FIRST_LABEL_LAYER_ID = "waterway_line_label";

interface SatelliteLayerProps {
  visible: boolean;
}

export function SatelliteLayer({ visible }: SatelliteLayerProps) {
  return (
    <Source
      id="satellite"
      type="raster"
      tiles={SATELLITE_TILES}
      tileSize={256}
      maxzoom={SATELLITE_MAX_ZOOM}
      attribution="Imagens © Esri"
    >
      <Layer
        id="satellite"
        type="raster"
        beforeId={FIRST_LABEL_LAYER_ID}
        layout={{ visibility: visible ? "visible" : "none" }}
      />
    </Source>
  );
}
