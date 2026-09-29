import { useState } from "react";

// Conjunto de ids ligados/desligados: ocultos (pontos, trechos) ou ativos (modelos 3D)
export function useToggleSet() {
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());

  function toggle(id: string) {
    setIds((prev) => {
      const next = new Set(prev); // cópia: o React só re-renderiza se a referência mudar
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function reset() {
    setIds(new Set());
  }

  return { ids, toggle, reset };
}
