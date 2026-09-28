import { Popup } from "react-map-gl/maplibre";
import { PIN_SIZE } from "./PointsLayer";
import type { MapPoint } from "./types";
import { AttributesTable } from "../../components/AttributesTable";

interface PointPopupProps {
  point: MapPoint;
  onClose: () => void;
}

export function PointPopup({ point, onClose }: PointPopupProps) {
  return (
    <Popup
      longitude={point.lng}
      latitude={point.lat}
      anchor="bottom"
      offset={PIN_SIZE}
      maxWidth="320px"
      onClose={onClose}
    >
      <div className="max-h-64 overflow-y-auto text-xs">
        <strong className="text-sm">{point.name}</strong>
        <AttributesTable attributes={point.attributes} />
      </div>
    </Popup>
  );
}
