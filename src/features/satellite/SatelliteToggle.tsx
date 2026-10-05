import { MapIcon, Satellite } from "lucide-react";
import { CONTROL_ICON_SIZE, MapControlButton } from "../map/MapControlButton";

interface SatelliteToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

export function SatelliteToggle({ enabled, onToggle }: SatelliteToggleProps) {
  return (
    <MapControlButton label={enabled ? "Ver mapa de ruas" : "Ver satélite"} pressed={enabled} onClick={onToggle}>
      {enabled ? <MapIcon size={CONTROL_ICON_SIZE} /> : <Satellite size={CONTROL_ICON_SIZE} />}
    </MapControlButton>
  );
}
