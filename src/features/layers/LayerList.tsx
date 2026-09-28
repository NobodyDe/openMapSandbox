import { useState } from "react";
import { LayerItemRow } from "./LayerItemRow";
import type { LayerItem } from "./types";

interface LayerListProps {
  items: LayerItem[];
  hiddenIds: ReadonlySet<string>;
  onToggleHidden: (id: string) => void;
}

export function LayerList({
  items,
  hiddenIds,
  onToggleHidden,
}: LayerListProps) {
  // só um item aberto por vez: apenas a tabela dele existe no DOM
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (items.length === 0) {
    return <p className="p-4 text-sm text-slate-500">Nenhum item importado.</p>;
  }

  return (
    <ul>
      {items.map((item) => (
        <LayerItemRow
          key={item.id}
          item={item}
          hidden={hiddenIds.has(item.id)}
          expanded={expandedId === item.id}
          onToggleHidden={() => onToggleHidden(item.id)}
          onToggleExpanded={() =>
            setExpandedId((current) => (current === item.id ? null : item.id))
          }
        />
      ))}
    </ul>
  );
}
