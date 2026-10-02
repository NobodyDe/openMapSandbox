import type { MapRef } from "react-map-gl/maplibre";
import type { BBox } from "../map/useBasemapBuildingMask";

// Nominatim (OpenStreetMap): grátis e entende português, mas pede no máximo 1 busca por
// segundo. Por isso a busca só acontece no Enter/botão, nunca a cada tecla
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export interface Place {
  name: string;
  lng: number;
  lat: number;
  bbox: BBox; // [oeste, sul, leste, norte]
}

interface NominatimResult {
  name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string]; // [sul, norte, oeste, leste]
}

export async function searchPlace(query: string): Promise<Place | null> {
  const params = new URLSearchParams({
    q: query,
    // Sem filtro de tipo: o Nominatim já devolve o país OU a cidade conforme o nome
    // ("brasil" → país, "campinas" → cidade). Filtrar por "city" faria "brasil" não achar nada
    format: "jsonv2",
    limit: "1",
    "accept-language": "pt-BR",
  });
  const response = await fetch(`${NOMINATIM_URL}?${params}`);
  if (!response.ok) throw new Error(`Busca falhou: HTTP ${response.status}`);
  const [result]: NominatimResult[] = await response.json();
  if (!result) return null;
  const [south, north, west, east] = result.boundingbox.map(Number);
  return { name: result.name, lng: Number(result.lon), lat: Number(result.lat), bbox: [west, south, east, north] };
}

// Mais lento que o padrão do MapLibre (1.2): o mapa se afasta e aproxima em arco até o
// destino, sem "teleporte". essential: anima mesmo com "reduzir movimento" no sistema
const FLIGHT = { speed: 0.8, curve: 1.42, essential: true };
const PADDING = 60; // px de folga em volta do lugar
// Cidades pequenas têm caixas minúsculas e o enquadramento iria a zoom 15+ (nível das casas).
// 12 mostra a cidade inteira com as ruas principais. Países nunca chegam perto disso
const MAX_PLACE_ZOOM = 12;
// Países com território dos dois lados da linha de data (EUA, Rússia) vêm com uma caixa do
// mundo inteiro: nesses casos voa para o ponto central do país com este zoom
const WORLD_SPANNING_ZOOM = 3;

export function flyToPlace(map: MapRef, { lng, lat, bbox: [west, south, east, north] }: Place) {
  const camera =
    east - west > 180
      ? { center: [lng, lat] as [number, number], zoom: WORLD_SPANNING_ZOOM }
      : map.cameraForBounds([[west, south], [east, north]], { padding: PADDING, maxZoom: MAX_PLACE_ZOOM });
  if (camera) map.flyTo({ ...camera, ...FLIGHT });
}
