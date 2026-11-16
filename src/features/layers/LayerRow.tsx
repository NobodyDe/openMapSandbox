import { memo, type ReactNode } from "react";
import { Ellipsis, Trash2, X } from "lucide-react";
import { FOLDER_KINDS } from "./folderKinds";
import { describeItem } from "./layerItemText";
import { VisibilityButton } from "./VisibilityButton";
import type { ModelStatus } from "../models3d/models";
import type { FolderItem, FolderKind } from "./types";

// Só modelos 3D têm status; "ready" não precisa de aviso, a descrição normal volta.
// Envio e conversão já chegam com o texto pronto (statusText)
const STATUS_TEXT: Partial<Record<ModelStatus, string>> = {
  loading: "Carregando…",
  error: "Erro ao carregar",
};

// Enquanto o servidor trabalha, o botão cancela; depois, remove
const BUSY: ModelStatus[] = ["uploading", "queued", "converting"];

interface LayerRowProps {
  kind: FolderKind;
  item: FolderItem;
  hidden: boolean;
  status?: ModelStatus;
  statusText?: string; // primitivos, não o objeto de atividade: o memo compara por referência
  expanded: boolean;
  // recebem o id (e não são closures por linha): assim são as mesmas funções em todo render
  onToggleHidden: (id: string) => void;
  onToggleExpanded: (id: string) => void;
  onRemove?: (id: string) => void; // só modelos 3D
  details: ReactNode; // o que abre no "…": atributos do KMZ ou calibração do modelo
}

// memo: com ~1.400 itens, clicar num olho re-renderiza só a linha que mudou
export const LayerRow = memo(function LayerRow({
  kind,
  item,
  hidden,
  status,
  statusText,
  expanded,
  onToggleHidden,
  onToggleExpanded,
  onRemove,
  details,
}: LayerRowProps) {
  const { icon: Icon } = FOLDER_KINDS[kind];
  const { label, detail } = describeItem(kind, item);
  // cor vinda do KMZ em tempo de execução: style, não classe do Tailwind
  const color = "color" in item ? item.color : undefined;
  const busy = status !== undefined && BUSY.includes(status);
  const removeLabel = busy ? "Cancelar" : "Remover";

  return (
    <li>
      <div className="flex items-center gap-3 py-1.5 pl-9 pr-3">
        <div className={`flex min-w-0 flex-1 items-center gap-3 ${hidden ? "opacity-50" : ""}`}>
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-teal-700"
            style={{ color }}
          >
            <Icon size={16} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-slate-800">{label}</span>
            <span className={`block truncate text-xs ${status === "error" ? "text-red-600" : "text-slate-500"}`}>
              {statusText ?? (status && STATUS_TEXT[status]) ?? detail}
            </span>
          </span>
        </div>
        <VisibilityButton hidden={hidden} onClick={() => onToggleHidden(item.id)} />
        {onRemove && (
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            title={removeLabel}
            aria-label={removeLabel}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
          >
            {busy ? <X size={18} /> : <Trash2 size={18} />}
          </button>
        )}
        <button
          type="button"
          onClick={() => onToggleExpanded(item.id)}
          title="Detalhes"
          aria-label="Detalhes"
          aria-expanded={expanded}
          className="rounded p-1 text-slate-500 hover:bg-slate-100"
        >
          <Ellipsis size={18} />
        </button>
      </div>
      {expanded && <div className="pb-2 pl-9 pr-3 text-xs">{details}</div>}
    </li>
  );
});
