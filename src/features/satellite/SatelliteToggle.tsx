import { MapIcon, Satellite } from "lucide-react";

interface SatelliteToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

export function SatelliteToggle({ enabled, onToggle }: SatelliteToggleProps) {
  const label = enabled ? "Ver mapa de ruas" : "Ver satélite";
  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={label}
      aria-pressed={enabled}
      className="rounded bg-white p-1.5 shadow hover:bg-slate-100"
    >
      {enabled ? <MapIcon size={18} /> : <Satellite size={18} />}
    </button>
  );
}
