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

  const trechosGeoJson = useMemo(
    () => trechosToFeatureCollection(trechos),
    [trechos],
  );
  const trechosById = useMemo(
    () => new Map(trechos.map((t) => [t.id, t])),
    [trechos],
  );
  const selectedTrecho = selected && trechosById.get(selected.id);

  return (
    <div className="relative h-screen w-full">
      <div className="absolute left-3 top-3 z-10 flex gap-2">
        <KmzPointsInput onLoad={setPoints} />
        <KmzTrechosInput onLoad={setTrechos} />
      </div>
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
        <PointsLayer points={points} onSelect={setSelectedPoint} />
        {selectedPoint && (
          <PointPopup
            point={selectedPoint}
            onClose={() => setSelectedPoint(null)}
          />
        )}

        <TrechosLayer data={trechosGeoJson} hoveredId={hoveredId} />
        {selected && selectedTrecho && (
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
