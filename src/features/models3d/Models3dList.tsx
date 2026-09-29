import { Eye, EyeOff } from "lucide-react";
import type { Model3dConfig, ModelStatus } from "./models";

const STATUS_TEXT: Record<ModelStatus, string> = {
  loading: "Carregando…",
  ready: "No mapa",
  error: "Erro ao carregar",
};

interface Models3dListProps {
  models: Model3dConfig[];
  enabledIds: ReadonlySet<string>;
  status: Record<string, ModelStatus>;
  onToggle: (id: string) => void;
}

export function Models3dList({ models, enabledIds, status, onToggle }: Models3dListProps) {
  return (
    <ul>
      {models.map((model) => {
        const enabled = enabledIds.has(model.id);
        const modelStatus = enabled ? status[model.id] : undefined;
        const label = enabled ? "Ocultar do mapa" : "Mostrar no mapa";

        return (
          <li
            key={model.id}
            className={`flex items-start gap-2 border-b border-slate-100 px-3 py-2 ${enabled ? "" : "opacity-50"}`}
          >
            <button
              type="button"
              onClick={() => onToggle(model.id)}
              title={label}
              aria-label={label}
              aria-pressed={enabled}
              className="mt-0.5 text-slate-500 hover:text-slate-900"
            >
              {enabled ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{model.name}</span>
              {modelStatus && (
                <span
                  className={`block text-xs ${modelStatus === "error" ? "text-red-600" : "text-slate-500"}`}
                >
                  {STATUS_TEXT[modelStatus]}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
