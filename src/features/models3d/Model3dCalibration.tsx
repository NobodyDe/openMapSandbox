import { Copy, Crosshair, LocateFixed } from "lucide-react";
import type { Anchor } from "./models";

// ≈ 1,1 m em latitude: com o campo em foco, cada seta ↑/↓ do teclado move o modelo ~1 m
const DEGREE_STEP = 0.00001;

const FIELDS: { key: keyof Anchor; label: string; step: number }[] = [
  { key: "lat", label: "Latitude (°)", step: DEGREE_STEP },
  { key: "lng", label: "Longitude (°)", step: DEGREE_STEP },
  { key: "altitude", label: "Altitude (m)", step: 0.5 },
  { key: "bearingDeg", label: "Rotação (°)", step: 1 },
];

function toConfigSnippet({ lng, lat, altitude, bearingDeg }: Anchor): string {
  return [
    `position: { lng: ${lng.toFixed(7)}, lat: ${lat.toFixed(7)} },`,
    `altitude: ${altitude},`,
    `bearingDeg: ${bearingDeg},`,
  ].join("\n");
}

interface Model3dCalibrationProps {
  anchor: Anchor;
  onChange: (anchor: Anchor) => void;
  onUseMapCenter: () => void;
  onFlyTo: () => void;
}

const BUTTON =
  "flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-100";

export function Model3dCalibration({
  anchor,
  onChange,
  onUseMapCenter,
  onFlyTo,
}: Model3dCalibrationProps) {
  return (
    <div className="space-y-1.5 border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs">
      {FIELDS.map(({ key, label, step }) => (
        <label key={key} className="flex items-center justify-between gap-2">
          <span className="text-slate-600">{label}</span>
          <input
            type="number"
            step={step}
            value={anchor[key]}
            onChange={(e) => {
              const value = e.target.valueAsNumber;
              if (Number.isFinite(value)) onChange({ ...anchor, [key]: value });
            }}
            className="w-32 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-right"
          />
        </label>
      ))}

      <div className="flex flex-wrap gap-1.5 pt-1">
        <button type="button" onClick={onUseMapCenter} className={BUTTON}>
          <Crosshair size={14} /> Usar centro do mapa
        </button>
        <button type="button" onClick={onFlyTo} className={BUTTON}>
          <LocateFixed size={14} /> Ir até o modelo
        </button>
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(toConfigSnippet(anchor))}
          className={BUTTON}
        >
          <Copy size={14} /> Copiar config
        </button>
      </div>
    </div>
  );
}
