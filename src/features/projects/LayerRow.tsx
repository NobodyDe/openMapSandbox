import type { ReactNode } from "react";
import { Box, Building, Ellipsis, Route, Sparkles, X, type LucideIcon } from "lucide-react";
import type { Model3dConfig, ModelActivity, ModelStatus } from "../models3d/models";
import { elementIds } from "./elements";
import { ElementRow } from "./ElementRow";
import type { ShownLayer } from "./search";
import type { ProjectsState } from "./useProjects";
import { VisibilityButton } from "./VisibilityButton";

const ICONS: Record<string, LucideIcon> = {
  KMZ: Route,
  IFC: Building,
  FRAG: Building,
  LAS: Sparkles,
  LAZ: Sparkles,
  GLB: Box,
};

// Envio e conversão chegam com o texto pronto; a carga no mapa só tem o status
const LOAD_TEXT: Partial<Record<ModelStatus, string>> = {
  loading: "Carregando…",
  error: "Erro ao carregar",
};

// Enquanto o servidor trabalha, o botão da linha cancela
const BUSY: ModelStatus[] = ["uploading", "queued", "converting"];

interface LayerRowProps {
  shown: ShownLayer; // elementos já filtrados pela pesquisa e pela aba
  state: ProjectsState;
  activity: ModelActivity | undefined;
  open: boolean; // elementos do KMZ à mostra
  onToggleOpen: (id: string) => void;
  expandedId: string | null; // um só aberto no painel inteiro: detalhes da camada ou atributos de um elemento
  onToggleExpanded: (id: string) => void;
  renderModelDetails: (model: Model3dConfig) => ReactNode;
}

function summaryOf({ layer }: ShownLayer): string | null {
  return layer.kind === "kmz" ? `${layer.points.length} pt · ${layer.trechos.length} ln` : null;
}

export function LayerRow({
  shown,
  state,
  activity,
  open,
  onToggleOpen,
  expandedId,
  onToggleExpanded,
  renderModelDetails,
}: LayerRowProps) {
  const { layer, points, trechos } = shown;
  const Icon = ICONS[layer.fileType] ?? Box;
  // contagem sobre a camada inteira, não só sobre o que a pesquisa mostra
  const ids = elementIds(layer);
  const on = ids.some((id) => !state.hiddenIds.has(id));
  const busy = activity !== undefined && BUSY.includes(activity.status);
  const statusText = activity?.text ?? (activity && LOAD_TEXT[activity.status]);
  const summary = summaryOf(shown);

  return (
    <li>
      <div className="flex items-center gap-1.5 py-1 pl-2 pr-3">
        <button
          type="button"
          onClick={() => onToggleOpen(layer.id)}
          disabled={layer.kind !== "kmz"}
          aria-expanded={layer.kind === "kmz" ? open : undefined}
          className={`flex min-w-0 flex-1 items-center gap-2 text-left ${on ? "" : "opacity-60"}`}
        >
          <Icon size={15} className="shrink-0 text-slate-500" />
          <span className="truncate text-sm text-slate-800">{layer.name}</span>
          <span className="shrink-0 rounded-[2px] border border-slate-300 px-1 text-[10px] font-medium leading-4 text-slate-500">
            {layer.fileType}
          </span>
          {summary && <span className="shrink-0 text-xs text-slate-500">{summary}</span>}
        </button>
        {busy ? (
          <button
            type="button"
            onClick={() => state.removeLayer(layer.id)}
            title="Cancelar"
            aria-label="Cancelar"
            className="rounded-[2px] p-1 text-slate-500 hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        ) : (
          // algum ligado → desliga todos; todos desligados → liga todos. Camada vazia não aparece desligada
          <VisibilityButton hidden={ids.length > 0 && !on} onClick={() => state.setHidden(ids, on)} />
        )}
        <button
          type="button"
          onClick={() => onToggleExpanded(layer.id)}
          title="Detalhes"
          aria-label="Detalhes"
          aria-expanded={expandedId === layer.id}
          className="rounded-[2px] p-1 text-slate-500 hover:bg-slate-100"
        >
          <Ellipsis size={16} />
        </button>
      </div>

      {statusText && (
        <p className={`truncate pl-8 pr-3 text-xs ${activity?.status === "error" ? "text-red-600" : "text-slate-500"}`}>
          {statusText}
        </p>
      )}
      {busy && (
        <div className="ml-8 mr-3 mt-1 h-px bg-slate-200">
          <div className="h-px bg-slate-900" style={{ width: `${(activity.progress ?? 0) * 100}%` }} />
        </div>
      )}

      {expandedId === layer.id && (
        <div className="space-y-2 pb-2 pl-8 pr-3 pt-1 text-xs">
          {layer.kind === "model" && renderModelDetails(layer.model)}
          <button type="button" onClick={() => state.removeLayer(layer.id)} className="text-red-600 hover:underline">
            Remover camada
          </button>
        </div>
      )}

      {open && layer.kind === "kmz" && (
        <ul className="ml-4 border-l border-slate-200">
          {points.map((point) => (
            <ElementRow
              key={point.id}
              id={point.id}
              name={point.name}
              kind="point"
              color={point.color}
              attributes={point.attributes}
              hidden={state.hiddenIds.has(point.id)}
              expanded={expandedId === point.id}
              onToggleHidden={state.toggle}
              onToggleExpanded={onToggleExpanded}
            />
          ))}
          {trechos.map((trecho) => (
            <ElementRow
              key={trecho.id}
              id={trecho.id}
              name={trecho.name}
              kind="line"
              color={trecho.color}
              attributes={trecho.attributes}
              hidden={state.hiddenIds.has(trecho.id)}
              expanded={expandedId === trecho.id}
              onToggleHidden={state.toggle}
              onToggleExpanded={onToggleExpanded}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
