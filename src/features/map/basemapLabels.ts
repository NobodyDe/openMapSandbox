import type { Map as MapLibreMap } from "maplibre-gl";

// Zoom em que a escala do mapa (ScaleControl, barra de 100 px) chega a 1000 km.
// Mais afastado que isso: só o planeta e as estrelas, sem nomes de países, oceanos ou cidades
export const LABELS_MIN_ZOOM = 3;
const BASEMAP_SOURCE = "openmaptiles"; // só os rótulos do mapa base, nunca as nossas camadas

export function hideBasemapLabelsBelow(map: MapLibreMap, minZoom: number) {
  for (const layer of map.getStyle().layers) {
    if (layer.type !== "symbol" || layer.source !== BASEMAP_SOURCE) continue;
    // Mantém o minzoom próprio da camada quando ele já é maior (ex.: nomes de ruas)
    map.setLayerZoomRange(layer.id, Math.max(layer.minzoom ?? 0, minZoom), layer.maxzoom ?? 24);
  }
}
