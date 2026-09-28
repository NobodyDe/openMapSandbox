import { Eye, EyeOff } from "lucide-react";
import { AttributesTable } from "../../components/AttributesTable";
import { itemDescription, itemLabel } from "./layerItemText";
import type { LayerItem } from "./types";

interface LayerItemRowProps {
  item: LayerItem;
  hidden: boolean;
  expanded: boolean;
  onToggleHidden: () => void;
  onToggleExpanded: () => void;
}

export function LayerItemRow({
  item,
  hidden,
  expanded,
  onToggleHidden,
  onToggleExpanded,
}: LayerItemRowProps) {
  const visibilityLabel = hidden ? "Mostrar no mapa" : "Ocultar do mapa";

  return (
    <li className={`border-b border-slate-100 ${hidden ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onToggleHidden}
          title={visibilityLabel}
          aria-label={visibilityLabel}
          aria-pressed={hidden}
          className="mt-0.5 text-slate-500 hover:text-slate-900"
        >
          {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>

        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          {/* style e não classe Tailwind: a cor vem do KMZ em tempo de execução */}
          <span
            className="mt-1.5 size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium">
              {itemLabel(item.attributes)}
            </span>
            <span className="block truncate text-xs text-slate-500">
              {itemDescription(item.attributes)}
            </span>
          </span>
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-2 text-xs">
          <AttributesTable attributes={item.attributes} />
        </div>
      )}
    </li>
  );
}
