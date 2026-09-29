import { Globe, Grid2x2 } from "lucide-react";

export type MapProjection = "globe" | "mercator";

interface ProjectionToggleProps {
  projection: MapProjection;
  onToggle: () => void;
}

export function ProjectionToggle({ projection, onToggle }: ProjectionToggleProps) {
  const isGlobe = projection === "globe";
  const label = isGlobe ? "Ver mapa plano" : "Ver em globo";
  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={label}
      aria-pressed={isGlobe}
      className="rounded bg-white p-1.5 shadow hover:bg-slate-100"
    >
      {isGlobe ? <Grid2x2 size={18} /> : <Globe size={18} />}
    </button>
  );
}
