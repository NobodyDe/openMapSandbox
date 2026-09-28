// "MapGL" e não "Map": o nome Map esconderia o Map nativo do JS usado no trechosById
import MapGL, {
  NavigationControl,
  GeolocateControl,
  ScaleControl,
  Source,
  Layer,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { municipalityBordersUrl } from "../../lib/ibge";
import { useMemo, useState } from "react";
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
import { useHiddenIds } from "../layers/useHiddenIds";
import { LayerList } from "../layers/LayerList";
import { LayersAside } from "../layers/LayersAside";

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
  const [layersOpen, setLayersOpen] = useState(false);
  const {
    hiddenIds: hiddenPointIds,
    toggle: togglePoint,
    reset: resetHiddenPoints,
  } = useHiddenIds();
  const {
    hiddenIds: hiddenTrechoIds,
    toggle: toggleTrecho,
    reset: resetHiddenTrechos,
  } = useHiddenIds();

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
    <div className="relative h-screen w-full">
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
          ]}
        />
      )}
      <div className="absolute right-2.5 top-1/2 z-10 -translate-y-1/2">
        <SatelliteToggle
          enabled={satellite}
          onToggle={() => setSatellite((v) => !v)}
        />
      </div>
      <MapGL
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

        <NavigationControl position="top-right" />
        <GeolocateControl position="top-right" />
        <ScaleControl unit="metric" />
      </MapGL>
    </div>
  );
}
