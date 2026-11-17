import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, Plus, Search } from "lucide-react";
import type { Model3dConfig, ModelActivity } from "../models3d/models";
import { projectElementIds } from "./elements";
import { ProjectForm } from "./ProjectForm";
import { ProjectSection } from "./ProjectSection";
import { searchProjects } from "./search";
import type { LngLat, Project } from "./types";
import { toggleIn, type ProjectsState } from "./useProjects";

type Tab = "all" | "on";

interface ProjectsPanelProps {
  projects: ProjectsState;
  activity: Record<string, ModelActivity>; // envio/conversão e carga no mapa, por camada
  focusProjectId: string | null; // marcador clicado: expande e rola até ele
  onPickLocation: (onPicked: (point: LngLat) => void) => void; // "Marcar no mapa"
  onFlyTo: (project: Project) => void;
  renderModelDetails: (model: Model3dConfig) => ReactNode; // a calibração vive no MapView
  onClose: () => void;
}

function byDateDesc(a: Project, b: Project): number {
  return b.date.localeCompare(a.date);
}

export function ProjectsPanel({
  projects: state,
  activity,
  focusProjectId,
  onPickLocation,
  onFlyTo,
  renderModelDetails,
  onClose,
}: ProjectsPanelProps) {
  const { projects, hiddenIds } = state;
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(new Set()); // projetos fechados
  const [openLayerIds, setOpenLayerIds] = useState<ReadonlySet<string>>(new Set()); // KMZ com elementos à mostra
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Marcador clicado: o projeto abre ("ajustar estado durante o render", padrão do React) e a lista rola até ele
  const [lastFocusId, setLastFocusId] = useState(focusProjectId);
  if (focusProjectId !== lastFocusId) {
    setLastFocusId(focusProjectId);
    if (focusProjectId && collapsedIds.has(focusProjectId)) setCollapsedIds(toggleIn(collapsedIds, focusProjectId));
  }
  useEffect(() => {
    if (focusProjectId) document.getElementById(`project-${focusProjectId}`)?.scrollIntoView({ behavior: "smooth" });
  }, [focusProjectId]);

  const search = query.trim().toLowerCase();
  const filtering = search !== "" || tab === "on";
  const shown = useMemo(
    () => searchProjects([...projects].sort(byDateDesc), search, tab === "on", hiddenIds),
    [projects, search, tab, hiddenIds],
  );
  const layerCount = projects.reduce((total, project) => total + project.layers.length, 0);
  const onCount = useMemo(
    () => projects.flatMap(projectElementIds).filter((id) => !hiddenIds.has(id)).length,
    [projects, hiddenIds],
  );

  const toggleProjectOpen = (id: string) => setCollapsedIds((prev) => toggleIn(prev, id));
  const toggleLayerOpen = (id: string) => setOpenLayerIds((prev) => toggleIn(prev, id));
  const toggleExpanded = (id: string) => setExpandedId((current) => (current === id ? null : id));

  return (
    <aside className="absolute inset-y-0 left-0 z-20 flex w-[22rem] max-w-full flex-col border-r border-slate-200 bg-white tabular-nums">
      <header className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div>
          <h2 className="text-base font-medium text-slate-900">Projetos</h2>
          <p className="text-xs text-slate-500">
            {projects.length} projetos · {layerCount} camadas
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Fechar painel"
          aria-label="Fechar painel"
          className="rounded-[2px] border border-slate-300 p-1 text-slate-600 hover:bg-slate-100"
        >
          <ChevronLeft size={16} />
        </button>
      </header>

      <div className="space-y-2 px-4 pb-3">
        <label className="flex items-center gap-2 rounded-[2px] border border-slate-300 px-2 py-1.5 focus-within:border-slate-900">
          <Search size={14} className="text-slate-500" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar projeto, camada ou elemento"
            aria-label="Buscar projeto, camada ou elemento"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <div role="tablist" className="flex border-b border-slate-200 text-sm">
          {(["all", "on"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`-mb-px border-b px-3 py-1.5 ${
                tab === value ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500"
              }`}
            >
              {value === "all" ? "Todos" : `Ligados ${onCount}`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {shown.map((projectShown) => (
          <ProjectSection
            key={projectShown.project.id}
            shown={projectShown}
            open={filtering || !collapsedIds.has(projectShown.project.id)} // pesquisando: abre para mostrar o resultado
            selected={projectShown.project.id === focusProjectId}
            onToggleOpen={toggleProjectOpen}
            state={state}
            activity={activity}
            openLayerIds={filtering ? new Set(projectShown.layers.map(({ layer }) => layer.id)) : openLayerIds}
            onToggleLayerOpen={toggleLayerOpen}
            expandedId={expandedId}
            onToggleExpanded={toggleExpanded}
            onPickLocation={onPickLocation}
            onFlyTo={onFlyTo}
            renderModelDetails={renderModelDetails}
          />
        ))}
        {shown.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-500">Nada encontrado.</p>}
      </div>

      <footer className="border-t border-slate-200 p-4">
        {creating ? (
          <ProjectForm
            submitLabel="Criar projeto"
            onSubmit={(input) => {
              state.createProject(input);
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
            onPickLocation={onPickLocation}
          />
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex w-full items-center justify-center gap-2 rounded-[2px] bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Plus size={16} /> Novo projeto
          </button>
        )}
      </footer>
    </aside>
  );
}
