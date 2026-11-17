import { Folder } from "lucide-react";
import { Marker } from "react-map-gl/maplibre";
import type { Project } from "./types";

interface ProjectMarkerProps {
  project: Project;
  selected: boolean; // projeto aberto no painel
  onClick: () => void;
}

// Elemento DOM: rótulo, haste fina e losango no ponto exato. anchor="bottom" põe a base no
// ponto; o -mb-1 desce o losango até o centro dele cair ali
export function ProjectMarker({ project, selected, onClick }: ProjectMarkerProps) {
  const { location } = project;
  if (!location) return null; // projeto sem local não tem marcador
  return (
    <Marker
      longitude={location.lng}
      latitude={location.lat}
      anchor="bottom"
      onClick={(event) => {
        event.originalEvent.stopPropagation(); // não vira clique no mapa (popup de trecho, "Marcar no mapa")
        onClick();
      }}
    >
      <button type="button" title={`Abrir ${project.name}`} className="flex cursor-pointer flex-col items-center">
        <span
          className={`flex items-center gap-1.5 rounded-[2px] border px-2 py-1 text-xs tabular-nums ${
            selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-900"
          }`}
        >
          <Folder size={12} className="shrink-0" />
          <span className="max-w-40 truncate font-medium">{project.name}</span>
          <span className={selected ? "text-slate-300" : "text-slate-500"}>{project.layers.length}</span>
        </span>
        <span className="h-4 w-px bg-slate-900" />
        <span className="-mb-1 size-2 rotate-45 border border-slate-900 bg-white" />
      </button>
    </Marker>
  );
}
