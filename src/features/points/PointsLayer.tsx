import { memo } from "react";
import { Marker } from "react-map-gl/maplibre";
import { MapPin } from "lucide-react";
import type { MapPoint } from "./types";

export const PIN_SIZE = 28;

interface PointsLayerProps {
  points: MapPoint[];
  onSelect: (point: MapPoint) => void;
}

// memo: o MapView re-renderiza a cada hover de trecho; sem isso, os 879 pins seriam recalculados junto
export const PointsLayer = memo(function PointsLayer({
  points,
  onSelect,
}: PointsLayerProps) {
  return points.map((point) => (
    <Marker
      key={point.id}
      longitude={point.lng}
      latitude={point.lat}
      anchor="bottom"
      onClick={(e) => {
        e.originalEvent.stopPropagation(); // senão o clique chega ao mapa e fecha o popup na mesma hora
        onSelect(point);
      }}
    >
      <MapPin
        size={PIN_SIZE}
        fill={point.color}
        color="white"
        strokeWidth={1.5}
        className="cursor-pointer drop-shadow origin-bottom transition-transform hover:scale-125"
      />
    </Marker>
  ));
});
