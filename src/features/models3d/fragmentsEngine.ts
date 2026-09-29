import { FragmentsModels } from "@thatopen/fragments";
import workerUrl from "@thatopen/fragments/worker?url"; // servido pelo Vite, sem CDN externo

let engine: FragmentsModels | null = null;

export function getFragmentsEngine(): FragmentsModels {
  if (!engine) {
    engine = new FragmentsModels(workerUrl);
    // Cada modelo tem a própria âncora no mapa; o alinhamento automático
    // deslocaria o 2º modelo em diante em relação ao 1º
    engine.settings.autoCoordinate = false;
  }
  return engine;
}
