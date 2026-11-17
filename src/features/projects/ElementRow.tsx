import { memo } from "react";
import { Dot, Spline } from "lucide-react";
import { AttributesTable } from "../../components/AttributesTable";
import { VisibilityButton } from "./VisibilityButton";

interface ElementRowProps {
  id: string;
  name: string;
  kind: "point" | "line";
  color: string;
  attributes: Record<string, string>;
  hidden: boolean;
  expanded: boolean;
  // recebem o id (e não são closures por linha): assim são as mesmas funções em todo render
  onToggleHidden: (id: string) => void;
  onToggleExpanded: (id: string) => void;
}

// memo: com ~1.400 elementos, clicar num olho re-renderiza só a linha que mudou
export const ElementRow = memo(function ElementRow({
  id,
  name,
  kind,
  color,
  attributes,
  hidden,
  expanded,
  onToggleHidden,
  onToggleExpanded,
}: ElementRowProps) {
  const Icon = kind === "point" ? Dot : Spline;
  return (
    <li>
      <div className="flex items-center gap-2 py-0.5 pl-2 pr-3">
        <button
          type="button"
          onClick={() => onToggleExpanded(id)}
          aria-expanded={expanded}
          title="Atributos"
          className={`flex min-w-0 flex-1 items-center gap-2 text-left ${hidden ? "opacity-50" : ""}`}
        >
          {/* cor vinda do KMZ em tempo de execução: style, não classe do Tailwind */}
          <Icon size={14} className="shrink-0" style={{ color }} />
          <span className="truncate text-xs text-slate-700">{name || "Sem nome"}</span>
        </button>
        <VisibilityButton hidden={hidden} onClick={() => onToggleHidden(id)} />
      </div>
      {expanded && (
        <div className="pb-2 pl-7 pr-3 text-xs">
          <AttributesTable attributes={attributes} />
        </div>
      )}
    </li>
  );
});
