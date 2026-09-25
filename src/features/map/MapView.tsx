import Map, {
  NavigationControl,
  GeolocateControl,
  ScaleControl,
  Source,
  Layer,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { municipalityBordersUrl } from "../../lib/ibge";

const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const BRAZIL_VIEW = { longitude: -47.93, latitude: -15.78, zoom: 4 };
const MUNICIPALITY_MIN_ZOOM = 6; // abaixo disso as divisas viram "ruído" visual

export function MapView() {
  return (
    <div className="h-screen w-full">
      <Map initialViewState={BRAZIL_VIEW} mapStyle={BASEMAP_STYLE}>
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

        <NavigationControl position="top-right" />
        <GeolocateControl position="top-right" />
        <ScaleControl unit="metric" />
      </Map>
    </div>
  );
}
