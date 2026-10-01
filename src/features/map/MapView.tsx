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
import { atmosphereLight, atmosphereSky } from "./atmosphere";
import { hideBasemapLabelsBelow, LABELS_MIN_ZOOM } from "./basemapLabels";
import { municipalityBordersUrl } from "../../lib/ibge";
import { Suspense, lazy, useCallback, useMemo, useRef, useState } from "react";
import { KmzPointsInput } from "../points/KmzPointsInput";
import { PointsLayer } from "../points/PointsLayer";
import { PointPopup } from "../points/PointPopup";
import type { MapPoint } from "../points/types";

import { trechosToFeatureCollection } from "../trechos/trechoGeoJson";
import { TrechosLayer, TRECHOS_HIT_LAYER_ID } from "../trechos/TrechosLayer";
import { TrechoPopup } from "../trechos/TrechoPopup";
import { useTrechoInteraction } from "../trechos/useTrechoInteraction";
import type { Trecho } from "../trechos/types";
import { KmzTrechosInput } from "../trechos/KmzTrechosInput";
import { SatelliteLayer } from "../satellite/SatelliteLayer";
import { SatelliteToggle } from "../satellite/SatelliteToggle";
import { Layers } from "lucide-react";
import { useToggleSet } from "../layers/useToggleSet";
import { LayerList } from "../layers/LayerList";
import { LayersAside } from "../layers/LayersAside";
import {
  MODELS_3D,
  MODEL_CAMERA,
  type Anchor,
  type ModelStatus,
} from "../models3d/models";
import { Models3dList } from "../models3d/Models3dList";
import { Model3dCalibration } from "../models3d/Model3dCalibration";

// three + fragments (~2 MB) só são baixados quando o primeiro modelo é ligado
const Model3dLayer = lazy(() => import("../models3d/Model3dLayer"));
// three só é baixado quando o satélite é ligado (mesmo pedaço do Model3dLayer)
const StarsLayer = lazy(() => import("../stars/StarsLayer"));
const GlobeShadowLayer = lazy(() => import("../globeShadow/GlobeShadowLayer"));

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
  const [trechos, setTrechos] = useState<Trecho[]>([]);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [satellite, setSatellite] = useState(false);
  const [projection, setProjection] = useState<MapProjection>("globe"); // globo por padrão
  const [layersOpen, setLayersOpen] = useState(false);
  const {
    ids: hiddenPointIds,
    toggle: togglePoint,
    reset: resetHiddenPoints,
  } = useToggleSet();
  const {
    ids: hiddenTrechoIds,
    toggle: toggleTrecho,
    reset: resetHiddenTrechos,
  } = useToggleSet();
  const { ids: enabledModelIds, toggle: toggleModel } = useToggleSet();
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

  // Prédios do mapa base substituídos pelos modelos ligados. Uma máscara só para todos:
  // se cada modelo aplicasse a sua, o último apagaria a dos outros
  const basemapMask = useMemo(() => {
    const enabled = MODELS_3D.filter((model) => enabledModelIds.has(model.id));
    return {
      hiddenIds: enabled.flatMap(
        (model) => model.hiddenBasemapBuildingIds ?? [],
      ),
      clearAreas: enabled.flatMap((model) => model.basemapClearAreas ?? []),
    };
  }, [enabledModelIds]);
  useBasemapBuildingMask(mapRef, basemapMask);

  // A lista mostra todos (para poder reexibir); o mapa recebe só os visíveis
  const visiblePoints = useMemo(
    () => points.filter((p) => !hiddenPointIds.has(p.id)),
    [points, hiddenPointIds],
  );
  const visibleTrechos = useMemo(
    () => trechos.filter((t) => !hiddenTrechoIds.has(t.id)),
    [trechos, hiddenTrechoIds],
  );

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
      <div className="absolute left-3 top-3 z-10 flex gap-2">
        <button
          type="button"
          onClick={() => setLayersOpen(true)}
          className="flex items-center gap-1.5 rounded bg-white px-3 py-2 text-sm shadow"
        >
          <Layers size={16} /> Camadas
        </button>
        <KmzPointsInput
          onLoad={(loaded) => {
            setPoints(loaded);
            resetHiddenPoints();
          }}
        />
        <KmzTrechosInput
          onLoad={(loaded) => {
            setTrechos(loaded);
            resetHiddenTrechos();
          }}
        />
      </div>
      {layersOpen && (
        <LayersAside
          onClose={() => setLayersOpen(false)}
          tabs={[
            {
              label: `Pontos (${points.length})`,
              content: (
                <LayerList
                  items={points}
                  hiddenIds={hiddenPointIds}
                  onToggleHidden={togglePoint}
                />
              ),
            },
            {
              label: `Trechos (${trechos.length})`,
              content: (
                <LayerList
                  items={trechos}
                  hiddenIds={hiddenTrechoIds}
                  onToggleHidden={toggleTrecho}
                />
              ),
            },
            {
              label: "Modelos 3D",
              content: (
                <>
                  <Models3dList
                    models={MODELS_3D}
                    enabledIds={enabledModelIds}
                    status={modelStatus}
                    onToggle={toggleModel}
                  />
                  {MODELS_3D.filter(
                    (model) =>
                      enabledModelIds.has(model.id) && anchors[model.id],
                  ).map((model) => (
                    <section key={model.id}>
                      <h3 className="px-3 pt-2 text-xs font-semibold text-slate-500">
                        Calibração · {model.name}
                      </h3>
                      <Model3dCalibration
                        anchor={anchors[model.id]}
                        onChange={(anchor) => updateAnchor(model.id, anchor)}
                        onUseMapCenter={() => moveAnchorToMapCenter(model.id)}
                        onFlyTo={() => flyToAnchor(anchors[model.id])}
                      />
                    </section>
                  ))}
                </>
              ),
            },
          ]}
        />
      )}
      <div className="absolute right-2.5 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2">
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
      <MapGL
        ref={mapRef}
        onLoad={(event) => hideBasemapLabelsBelow(event.target, LABELS_MIN_ZOOM)}
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
        {selectedPoint && !hiddenPointIds.has(selectedPoint.id) && (
          <PointPopup
            point={selectedPoint}
            onClose={() => setSelectedPoint(null)}
          />
        )}

        <TrechosLayer data={trechosGeoJson} hoveredId={hoveredId} />
        {selected && selectedTrecho && !hiddenTrechoIds.has(selected.id) && (
          <TrechoPopup
            trecho={selectedTrecho}
            lng={selected.lng}
            lat={selected.lat}
            onClose={closePopup}
          />
        )}

        {/* Sem beforeId: o modelo fica acima de ruas, satélite e trechos; os pinos (DOM) seguem por cima */}
        <Suspense fallback={null}>
          {/* estrelas, sombra da noite, atmosfera e fundo escuro: todos seguem o satélite */}
          {satellite && <StarsLayer />}
          {satellite && <GlobeShadowLayer />}
          {MODELS_3D.filter((model) => enabledModelIds.has(model.id)).map(
            (config) => (
              <Model3dLayer
                key={config.id}
                config={config}
                anchor={anchors[config.id]}
                onAnchorResolved={handleAnchorResolved}
                onStatusChange={handleModelStatus}
              />
            ),
          )}
        </Suspense>

        <NavigationControl position="top-right" />
        <GeolocateControl position="top-right" />
        <ScaleControl unit="metric" />
      </MapGL>
    </div>
  );
}
