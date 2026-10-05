// "MapGL" e não "Map": o nome Map esconderia o Map nativo do JS usado no trechosById
import MapGL, {
  NavigationControl,
  GeolocateControl,
  ScaleControl,
  Source,
  Layer,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { useBasemapBuildingMask } from "./useBasemapBuildingMask";
import { ProjectionToggle, type MapProjection } from "./ProjectionToggle";
import { CONTROL_ICON_SIZE, MapControlButton } from "./MapControlButton";
import { atmosphereLight, atmosphereSky } from "./atmosphere";
import { hideBasemapLabelsBelow, LABELS_MIN_ZOOM } from "./basemapLabels";
import { municipalityBordersUrl } from "../../lib/ibge";
import { Suspense, lazy, useCallback, useMemo, useRef, useState } from "react";
import { PointsLayer } from "../points/PointsLayer";
import { PointPopup } from "../points/PointPopup";
import type { MapPoint } from "../points/types";

import { trechosToFeatureCollection } from "../trechos/trechoGeoJson";
import { TrechosLayer, TRECHOS_HIT_LAYER_ID } from "../trechos/TrechosLayer";
import { TrechoPopup } from "../trechos/TrechoPopup";
import { useTrechoInteraction } from "../trechos/useTrechoInteraction";
import { SatelliteLayer } from "../satellite/SatelliteLayer";
import { SatelliteToggle } from "../satellite/SatelliteToggle";
import { Layers } from "lucide-react";
import { itemsOfKind, useLayerFolders } from "../layers/useLayerFolders";
import { useVisibleItems } from "../layers/useVisibleItems";
import { LayersPanel } from "../layers/LayersPanel";
import {
  MODEL_CAMERA,
  type Anchor,
  type Model3dConfig,
  type ModelStatus,
} from "../models3d/models";
import { Model3dCalibration } from "../models3d/Model3dCalibration";
import { PlaceSearch } from "../search/PlaceSearch";
import { flyToPlace } from "../search/searchPlace";

// three + fragments (~2 MB) só são baixados quando o primeiro modelo é ligado
const Model3dLayer = lazy(() => import("../models3d/Model3dLayer"));
// three só é baixado quando o satélite é ligado (mesmo pedaço do Model3dLayer)
const StarsLayer = lazy(() => import("../stars/StarsLayer"));
const GlobeShadowLayer = lazy(() => import("../globeShadow/GlobeShadowLayer"));
const GlobeGlowLayer = lazy(() => import("../globeGlow/GlobeGlowLayer"));

const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const BRAZIL_VIEW = { longitude: -47.93, latitude: -15.78, zoom: 4 };
const MUNICIPALITY_MIN_ZOOM = 6; // abaixo disso as divisas viram "ruído" visual

export function MapView() {
  const {
    hoveredId,
    selected,
    onMouseMove,
    onMouseLeave,
    onClick,
    closePopup,
  } = useTrechoInteraction();
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [satellite, setSatellite] = useState(false);
  const [projection, setProjection] = useState<MapProjection>("globe"); // globo por padrão
  const [layersOpen, setLayersOpen] = useState(false);
  // Pastas, itens e visibilidade: o painel edita, o mapa desenha
  const layers = useLayerFolders();
  const { folders, hiddenIds } = layers;
  const points = useMemo(() => itemsOfKind(folders, "points"), [folders]);
  const trechos = useMemo(() => itemsOfKind(folders, "trechos"), [folders]);
  const models = useMemo(() => itemsOfKind(folders, "models"), [folders]);
  const [modelStatus, setModelStatus] = useState<Record<string, ModelStatus>>(
    {},
  );
  // useCallback: é dependência do efeito do Model3dLayer; uma função nova a cada render recarregaria o modelo
  const handleModelStatus = useCallback(
    (id: string, status: ModelStatus) =>
      setModelStatus((prev) => ({ ...prev, [id]: status })),
    [],
  );

  // Posição/altitude/rotação de cada modelo: única fonte da verdade enquanto o app roda
  const mapRef = useRef<MapRef>(null);
  const [anchors, setAnchors] = useState<Record<string, Anchor>>({});
  // Só grava se ainda não houver: religar o modelo mantém a calibração feita na sessão
  const handleAnchorResolved = useCallback(
    (id: string, anchor: Anchor) =>
      setAnchors((prev) => (prev[id] ? prev : { ...prev, [id]: anchor })),
    [],
  );

  function updateAnchor(id: string, anchor: Anchor) {
    setAnchors((prev) => ({ ...prev, [id]: anchor }));
  }

  function moveAnchorToMapCenter(id: string) {
    const center = mapRef.current?.getCenter();
    if (center)
      updateAnchor(id, { ...anchors[id], lng: center.lng, lat: center.lat });
  }

  function flyToAnchor(anchor: Anchor) {
    mapRef.current?.flyTo({
      center: [anchor.lng, anchor.lat],
      ...MODEL_CAMERA,
    });
  }

  // A lista mostra todos (para poder reexibir); o mapa recebe só os visíveis.
  // Modelo 3D visível = carregado: ocultar descarta o modelo e libera a memória
  const visiblePoints = useVisibleItems(points, hiddenIds);
  const visibleTrechos = useVisibleItems(trechos, hiddenIds);
  const visibleModels = useVisibleItems(models, hiddenIds);

  // Prédios do mapa base substituídos pelos modelos ligados. Uma máscara só para todos:
  // se cada modelo aplicasse a sua, o último apagaria a dos outros
  const basemapMask = useMemo(
    () => ({
      hiddenIds: visibleModels.flatMap(
        (model) => model.hiddenBasemapBuildingIds ?? [],
      ),
      clearAreas: visibleModels.flatMap(
        (model) => model.basemapClearAreas ?? [],
      ),
    }),
    [visibleModels],
  );
  useBasemapBuildingMask(mapRef, basemapMask);

  // Calibração aberta pelo "…" do modelo no painel. Só existe depois que o modelo carregou
  function renderModelDetails(model: Model3dConfig) {
    const anchor = anchors[model.id];
    if (!anchor)
      return (
        <p className="text-slate-500">
          Ligue o modelo para calibrar a posição.
        </p>
      );
    return (
      <Model3dCalibration
        anchor={anchor}
        onChange={(next) => updateAnchor(model.id, next)}
        onUseMapCenter={() => moveAnchorToMapCenter(model.id)}
        onFlyTo={() => flyToAnchor(anchor)}
      />
    );
  }

  const trechosGeoJson = useMemo(
    () => trechosToFeatureCollection(visibleTrechos),
    [visibleTrechos],
  );
  const trechosById = useMemo(
    () => new Map(trechos.map((t) => [t.id, t])),
    [trechos],
  );
  const selectedTrecho = selected && trechosById.get(selected.id);

  return (
    // Com satélite, fundo escuro: no globo é o "espaço" atrás da esfera, onde o halo (claro) aparece
    <div
      className={`relative h-screen w-full ${satellite ? "bg-[#010101]" : ""}`}
    >
      <PlaceSearch
        onFound={(place) => mapRef.current && flyToPlace(mapRef.current, place)}
      />
      {/* Coluna de controles da lateral: camadas, satélite e globo/plano, todos do mesmo tamanho */}
      <div className="absolute right-2.5 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2">
        <MapControlButton
          label={layersOpen ? "Fechar camadas" : "Camadas"}
          pressed={layersOpen}
          onClick={() => setLayersOpen((open) => !open)}
        >
          <Layers size={CONTROL_ICON_SIZE} />
        </MapControlButton>
        <SatelliteToggle
          enabled={satellite}
          onToggle={() => setSatellite((v) => !v)}
        />
        <ProjectionToggle
          projection={projection}
          onToggle={() =>
            setProjection((p) => (p === "globe" ? "mercator" : "globe"))
          }
        />
      </div>
      {/* Fora da coluna: ela é absolute e deslocada, e o painel se posicionaria dentro dela */}
      {layersOpen && (
        <LayersPanel
          layers={layers}
          modelStatus={modelStatus}
          renderModelDetails={renderModelDetails}
          onClose={() => setLayersOpen(false)}
        />
      )}
      <MapGL
        ref={mapRef}
        onLoad={(event) =>
          hideBasemapLabelsBelow(event.target, LABELS_MIN_ZOOM)
        }
        projection={projection}
        sky={atmosphereSky(satellite)} // a atmosfera acompanha o botão de satélite
        light={atmosphereLight(satellite)} // e o "sol" dela fica atrás da câmera
        initialViewState={BRAZIL_VIEW}
        mapStyle={BASEMAP_STYLE}
        interactiveLayerIds={[TRECHOS_HIT_LAYER_ID]}
        cursor={hoveredId ? "pointer" : undefined}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
      >
        <SatelliteLayer visible={satellite} />
        <Source
          id="municipios"
          type="geojson"
          data={municipalityBordersUrl("SP")}
        >
          <Layer
            id="municipios-divisa"
            type="line"
            minzoom={MUNICIPALITY_MIN_ZOOM}
            paint={{
              "line-color": "#64748b",
              "line-width": 1,
              "line-dasharray": [2, 2],
            }}
          />
        </Source>
        <PointsLayer points={visiblePoints} onSelect={setSelectedPoint} />
        {selectedPoint && !hiddenIds.has(selectedPoint.id) && (
          <PointPopup
            point={selectedPoint}
            onClose={() => setSelectedPoint(null)}
          />
        )}

        <TrechosLayer data={trechosGeoJson} hoveredId={hoveredId} />
        {selected && selectedTrecho && !hiddenIds.has(selected.id) && (
          <TrechoPopup
            trecho={selectedTrecho}
            lng={selected.lng}
            lat={selected.lat}
            onClose={closePopup}
          />
        )}

        {/* Sem beforeId: o modelo fica acima de ruas, satélite e trechos; os pinos (DOM) seguem por cima */}
        <Suspense fallback={null}>
          {/* estrelas, brilho da borda, sombra da noite, atmosfera e fundo escuro: todos seguem o satélite */}
          {satellite && <StarsLayer />}
          {/* depois das estrelas: as duas entram antes do "background", e a ordem de montagem
              deixa o brilho por cima delas */}
          {satellite && <GlobeGlowLayer />}
          {satellite && <GlobeShadowLayer />}
          {visibleModels.map((config) => (
            <Model3dLayer
              key={config.id}
              config={config}
              anchor={anchors[config.id]}
              onAnchorResolved={handleAnchorResolved}
              onStatusChange={handleModelStatus}
            />
          ))}
        </Suspense>

        <NavigationControl position="top-right" />
        <GeolocateControl position="top-right" />
        <ScaleControl unit="metric" />
      </MapGL>
    </div>
  );
}
