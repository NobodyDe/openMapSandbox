import type { BBox } from "../map/useBasemapBuildingMask";

export interface Model3dConfig {
  id: string;
  name: string;
  url: string;
  // Ajuste manual: cada campo informado vence o IfcSite (o IFC atual não tem georreferência precisa)
  position?: { lng: number; lat: number };
  altitude?: number; // metros; padrão 0 (o mapa não tem relevo)
  bearingDeg?: number; // rotação em graus, sentido horário a partir do norte; padrão 0
  // Prédios do mapa base que este modelo substitui (ids OSM da camada "building")
  hiddenBasemapBuildingIds?: number[];
  // Áreas [oeste, sul, leste, norte] onde partes de prédios do mapa somem. Para prédios que o
  // gerador de tiles agrupou com outros num mesmo id (esconder o id apagaria todos)
  basemapClearAreas?: BBox[];
}

export interface Anchor {
  lng: number;
  lat: number;
  altitude: number;
  bearingDeg: number;
}

// Mesmo enquadramento no voo automático e no botão "Ir até o modelo"
export const MODEL_CAMERA = { zoom: 18, pitch: 60 } as const;

// Aqui, e não no Model3dLayer: quem só lê o status não deve depender do módulo carregado sob demanda
export type ModelStatus = "loading" | "ready" | "error";

export const MODELS_3D: Model3dConfig[] = [
  {
    id: "hfc-fachada",
    name: "HFC — Fachada",
    url: "https://relatoriosfotograficos.blob.core.windows.net/gemeos-digitais/hfc_fachada.frag",
    position: { lng: -43.1895761, lat: -22.986445 },
    altitude: 26,
    bearingDeg: -1,
    // 63659910: o hotel (48 m, 3 partes). Atenção: NÃO usar 71695260 — é um objeto único que
    // agrupa ~447 prédios da região; escondê-lo apaga o bairro, não só as caixas da entrada
    hiddenBasemapBuildingIds: [63659910],
    // As 3 estruturas de 5 m na entrada: são 3 das ~447 partes do objeto 71695260
    basemapClearAreas: [[-43.189396, -22.985923, -43.189151, -22.985547]],
  },
];
