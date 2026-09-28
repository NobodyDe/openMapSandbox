import { useState } from "react";

export function useHiddenIds() {
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set());

  function toggle(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev); // cópia: o React só re-renderiza se a referência mudar
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function reset() {
    setHiddenIds(new Set());
  }

  return { hiddenIds, toggle, reset };
}
