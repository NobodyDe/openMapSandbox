import { Popup } from "react-map-gl/maplibre";
import { AttributesTable } from "../../components/AttributesTable";
import type { Trecho } from "./types";

interface TrechoPopupProps {
  trecho: Trecho;
  lng: number;
  lat: number;
  onClose: () => void;
}

export function TrechoPopup({ trecho, lng, lat, onClose }: TrechoPopupProps) {
  return (
    <Popup
      longitude={lng}
      latitude={lat}
      onClose={onClose}
      closeOnClick={false}
      maxWidth="320px"
    >
      <div className="max-h-64 overflow-y-auto text-xs">
        <strong className="text-sm">{trecho.name}</strong>
        <p>Extensão (geometria): {trecho.extensaoKm.toFixed(2)} km</p>
        <AttributesTable attributes={trecho.attributes} />
      </div>
    </Popup>
  );
}
