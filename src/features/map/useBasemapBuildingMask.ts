import { useEffect, type RefObject } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type {
  FilterSpecification,
  GeoJSONSource,
  LayerSpecification,
  GeoJSONFeature,
  MapSourceDataEvent,
} from "maplibre-gl";
import type { Feature, FeatureCollection, Polygon, Position } from "geojson";

// [oeste, sul, leste, norte] em graus
export type BBox = [number, number, number, number];

export interface BasemapBuildingMask {
  hiddenIds: number[]; // objetos inteiros a esconder (ex.: o prédio que o modelo 3D substitui)
  clearAreas: BBox[]; // áreas onde PARTES de prédios somem, mesmo dentro de objetos agrupados
}

const SOURCE = "openmaptiles";
const SOURCE_LAYER = "building";
const BUILDING_LAYERS = ["building", "building-3d"]; // camadas de prédios do estilo Liberty
const REBUILT_SOURCE = "basemap-buildings-rebuilt";
const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

const rebuiltLayerId = (layerId: string) => `${layerId}-rebuilt`;

function polygonsOf(feature: GeoJSONFeature): Position[][][] {
  const { geometry } = feature;
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

function isInAnyArea(ring: Position[], areas: BBox[]): boolean {
  const x = ring.reduce((sum, [lng]) => sum + lng, 0) / ring.length;
  const y = ring.reduce((sum, [, lat]) => sum + lat, 0) / ring.length;
  return areas.some(([west, south, east, north]) => x >= west && x <= east && y >= south && y <= north);
}

// O gerador de tiles agrupa centenas de prédios num único objeto (mesmo id), e o filtro
// do MapLibre só esconde objetos inteiros. Então: esconde o objeto e devolve as partes
// que NÃO estão nas áreas, para serem redesenhadas numa camada própria
function splitByAreas(features: GeoJSONFeature[], areas: BBox[]) {
  const affectedIds = new Set<number>();
  for (const feature of features) {
    if (polygonsOf(feature).some(([outer]) => isInAnyArea(outer, areas))) {
      affectedIds.add(Number(feature.id));
    }
  }

  // chave = contorno: o mesmo pedaço aparece repetido nos tiles vizinhos
  const keptParts = new Map<string, Feature<Polygon>>();
  for (const feature of features) {
    if (!affectedIds.has(Number(feature.id))) continue;
    for (const polygon of polygonsOf(feature)) {
      if (isInAnyArea(polygon[0], areas)) continue;
      keptParts.set(JSON.stringify(polygon[0]), {
        type: "Feature",
        // Cópia obrigatória: o properties do querySourceFeatures tem protótipo nulo (sem
        // hasOwnProperty), e a fonte GeoJSON falha em silêncio ao processá-lo
        properties: { ...feature.properties },
        geometry: { type: "Polygon", coordinates: polygon },
      });
    }
  }
  return { affectedIds, keptParts };
}

export function useBasemapBuildingMask(
  mapRef: RefObject<MapRef | null>,
  { hiddenIds, clearAreas }: BasemapBuildingMask,
) {
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || (hiddenIds.length === 0 && clearAreas.length === 0)) return;
    let lastKey = "";

    // Cópias das camadas originais lendo a nossa fonte: mesma aparência, logo abaixo delas na pilha
    const addRebuiltLayers = () => {
      if (map.getSource(REBUILT_SOURCE)) return;
      map.addSource(REBUILT_SOURCE, { type: "geojson", data: EMPTY });
      for (const layerId of BUILDING_LAYERS) {
        const original = map.getStyle().layers.find((layer) => layer.id === layerId);
        if (!original) continue;
        const clone: Record<string, unknown> = { ...original, id: rebuiltLayerId(layerId), source: REBUILT_SOURCE };
        delete clone["source-layer"]; // fonte GeoJSON não tem camadas internas
        delete clone.filter; // o filtro por id é da original; aqui já entram só as partes certas
        map.addLayer(clone as LayerSpecification, layerId);
      }
    };

    const apply = () => {
      const features = map.querySourceFeatures(SOURCE, { sourceLayer: SOURCE_LAYER });
      const { affectedIds, keptParts } = splitByAreas(features, clearAreas);
      const excludedIds = [...new Set([...hiddenIds, ...affectedIds])];
      // Os tiles chegam em várias levas: só mexe no mapa se o resultado mudou
      const key = `${excludedIds.join()}|${[...keptParts.keys()].join()}`;
      if (key === lastKey) return;
      lastKey = key;

      const filter: FilterSpecification = ["!", ["in", ["id"], ["literal", excludedIds]]];
      for (const layerId of BUILDING_LAYERS) {
        if (map.getLayer(layerId)) map.setFilter(layerId, filter);
      }
      map.getSource<GeoJSONSource>(REBUILT_SOURCE)?.setData({
        type: "FeatureCollection",
        features: [...keptParts.values()],
      });
    };

    // Refaz quando chegam tiles de prédios. Não usar o evento 'idle': com um modelo 3D ligado
    // o mapa redesenha em todo quadro e nunca fica ocioso, então 'idle' não dispara
    const onSourceData = (event: MapSourceDataEvent) => {
      if (event.sourceId === SOURCE && event.isSourceLoaded) apply();
    };

    const start = () => {
      addRebuiltLayers();
      apply();
      map.on("sourcedata", onSourceData);
    };

    // Não usar isStyleLoaded(): ele fica false enquanto QUALQUER tile carrega (ex.: durante o voo
    // até o modelo). Basta o estilo já ter sido lido, e isso se vê pela existência das camadas
    if (BUILDING_LAYERS.some((layerId) => map.getLayer(layerId))) start();
    else map.once("styledata", start);

    return () => {
      map.off("styledata", start);
      map.off("sourcedata", onSourceData);
      for (const layerId of BUILDING_LAYERS) {
        if (map.getLayer(rebuiltLayerId(layerId))) map.removeLayer(rebuiltLayerId(layerId));
        if (map.getLayer(layerId)) map.setFilter(layerId, null);
      }
      if (map.getSource(REBUILT_SOURCE)) map.removeSource(REBUILT_SOURCE);
    };
  }, [mapRef, hiddenIds, clearAreas]);
}
