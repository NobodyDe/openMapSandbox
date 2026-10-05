import { Globe, Grid2x2 } from "lucide-react";
import { CONTROL_ICON_SIZE, MapControlButton } from "./MapControlButton";

export type MapProjection = "globe" | "mercator";

interface ProjectionToggleProps {
  projection: MapProjection;
  onToggle: () => void;
}

export function ProjectionToggle({ projection, onToggle }: ProjectionToggleProps) {
  const isGlobe = projection === "globe";
  return (
    <MapControlButton label={isGlobe ? "Ver mapa plano" : "Ver em globo"} pressed={isGlobe} onClick={onToggle}>
      {isGlobe ? <Grid2x2 size={CONTROL_ICON_SIZE} /> : <Globe size={CONTROL_ICON_SIZE} />}
    </MapControlButton>
  );
}
