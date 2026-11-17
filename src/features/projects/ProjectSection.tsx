import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Ellipsis, Folder, MapPin, MapPinOff, Upload } from "lucide-react";
import type { Model3dConfig, ModelActivity } from "../models3d/models";
import { projectElementIds } from "./elements";
import { FileImportButton } from "./FileImportButton";
import { LayerRow } from "./LayerRow";
import { ProjectForm } from "./ProjectForm";
import type { ShownProject } from "./search";
import type { LngLat, Project } from "./types";
import type { ProjectsState } from "./useProjects";
import { VisibilityButton } from "./VisibilityButton";

const ACCEPT = ".kmz,.frag,.ifc,.glb,.las,.laz";

interface ProjectSectionProps {
  shown: ShownProject;
  open: boolean;
  selected: boolean; // marcador clicado
  onToggleOpen: (id: string) => void;
  state: ProjectsState;
  activity: Record<string, ModelActivity>;
  openLayerIds: ReadonlySet<string>;
  onToggleLayerOpen: (id: string) => void;
  expandedId: string | null;
  onToggleExpanded: (id: string) => void;
  onPickLocation: (onPicked: (point: LngLat) => void) => void;
  onFlyTo: (project: Project) => void;
  renderModelDetails: (model: Model3dConfig) => ReactNode;
}

// AAAA-MM-DD → dd/mm/aaaa
function formatDate(date: string): string {
  return date.split("-").reverse().join("/");
}

export function ProjectSection({
  shown,
  open,
  selected,
  onToggleOpen,
  state,
  activity,
  openLayerIds,
  onToggleLayerOpen,
  expandedId,
  onToggleExpanded,
  onPickLocation,
  onFlyTo,
  renderModelDetails,
}: ProjectSectionProps) {
  const { project, layers } = shown;
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const ids = projectElementIds(project);
  const on = ids.some((id) => !state.hiddenIds.has(id));
  const markerHidden = state.hiddenMarkers.has(project.id);
  const markerLabel = markerHidden ? "Mostrar no mapa" : "Esconder do mapa";

  function startEditing() {
    setMenuOpen(false);
    setEditing(true);
  }

  function confirmRemove() {
    if (confirm(`Excluir o projeto "${project.name}" e todas as camadas dele?`)) state.removeProject(project.id);
  }

  return (
    <section id={`project-${project.id}`} className="border-b border-slate-200">
      <div className={`flex items-center gap-1 px-3 py-2 ${selected ? "bg-slate-100" : ""}`}>
        <button
          type="button"
          onClick={() => onToggleOpen(project.id)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {open ? (
            <ChevronDown size={14} className="shrink-0 text-slate-500" />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-slate-500" />
          )}
          <Folder size={15} className="shrink-0 text-slate-500" />
          <span className="truncate text-sm font-medium text-slate-900">{project.name}</span>
          <span className="shrink-0 text-xs text-slate-500">
            {project.location ? formatDate(project.date) : "Sem local"}
          </span>
        </button>
        {project.location && (
          <button
            type="button"
            onClick={() => state.toggleMarker(project.id)}
            title={markerLabel}
            aria-label={markerLabel}
            aria-pressed={!markerHidden}
            className={`rounded-[2px] p-1 hover:bg-slate-100 ${markerHidden ? "text-slate-400" : "text-slate-700"}`}
          >
            {markerHidden ? <MapPinOff size={16} /> : <MapPin size={16} />}
          </button>
        )}
        {/* algum ligado → desliga todos; todos desligados → liga todos */}
        <VisibilityButton hidden={ids.length > 0 && !on} onClick={() => state.setHidden(ids, on)} />
        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          title="Opções do projeto"
          aria-label="Opções do projeto"
          aria-expanded={menuOpen}
          className="rounded-[2px] p-1 text-slate-500 hover:bg-slate-100"
        >
          <Ellipsis size={16} />
        </button>
      </div>

      {menuOpen && (
        <div className="flex gap-4 pb-2 pl-9 pr-3 text-xs">
          <button type="button" onClick={startEditing} className="text-slate-700 hover:underline">
            Editar
          </button>
          {project.location && (
            <button type="button" onClick={() => onFlyTo(project)} className="text-slate-700 hover:underline">
              Ir até o projeto
            </button>
          )}
          <button type="button" onClick={confirmRemove} className="text-red-600 hover:underline">
            Excluir projeto
          </button>
        </div>
      )}

      {editing && (
        <div className="pb-3 pl-9 pr-3">
          <ProjectForm
            initial={project}
            submitLabel="Salvar"
            onSubmit={(input) => {
              state.updateProject(project.id, input);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
            onPickLocation={onPickLocation}
          />
        </div>
      )}

      {open && (
        <ul className="mb-2 ml-[1.15rem] border-l border-slate-200">
          {layers.map((layerShown) => (
            <LayerRow
              key={layerShown.layer.id}
              shown={layerShown}
              state={state}
              activity={activity[layerShown.layer.id]}
              open={openLayerIds.has(layerShown.layer.id)}
              onToggleOpen={onToggleLayerOpen}
              expandedId={expandedId}
              onToggleExpanded={onToggleExpanded}
              renderModelDetails={renderModelDetails}
            />
          ))}
          <li className="py-1 pl-2 pr-3">
            <FileImportButton
              accept={ACCEPT}
              onFiles={(files) => state.importFiles(project.id, files)}
              className="flex items-center gap-2 rounded-[2px] border border-dashed border-slate-300 px-2 py-1.5 text-slate-600 hover:bg-slate-50"
            >
              <Upload size={14} />
              <span className="flex-1 text-xs">Importar arquivo</span>
              <span className="text-[10px] text-slate-400">KMZ · IFC · FRAG · GLB · LAS · LAZ</span>
            </FileImportButton>
          </li>
        </ul>
      )}
    </section>
  );
}
