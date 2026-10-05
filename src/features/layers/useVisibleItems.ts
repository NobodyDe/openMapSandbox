import { useMemo, useState } from "react";

function sameItems<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

// Itens que não estão ocultos, devolvendo o MESMO array enquanto o resultado não muda.
// Os ocultos de todas as pastas ficam num conjunto só: sem isto, ocultar um trecho criaria
// um array novo de pontos e o PointsLayer (memo) redesenharia os 879 pinos à toa
export function useVisibleItems<T extends { id: string }>(items: T[], hiddenIds: ReadonlySet<string>): T[] {
  const visible = useMemo(() => items.filter((item) => !hiddenIds.has(item.id)), [items, hiddenIds]);
  const [stable, setStable] = useState(visible);
  if (sameItems(stable, visible)) return stable;
  // "Ajustar estado durante o render" (padrão documentado do React): guarda o novo resultado
  setStable(visible);
  return visible;
}
