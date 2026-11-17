import type { MapPoint } from "../points/types";
import type { Trecho } from "../trechos/types";
import type { Layer, Project } from "./types";

// O que o painel mostra de cada camada e projeto depois da pesquisa e da aba "Ligados"
export interface ShownLayer {
  layer: Layer;
  points: MapPoint[];
  trechos: Trecho[];
}

export interface ShownProject {
  project: Project;
  layers: ShownLayer[];
}

function matches(name: string, query: string): boolean {
  return name.toLowerCase().includes(query);
}

// Nome do projeto ou da camada casando com a pesquisa: entram todos os elementos abaixo dele
function searchLayer(
  layer: Layer,
  query: string,
  parentMatches: boolean,
  onlyOn: boolean,
  hiddenIds: ReadonlySet<string>,
): ShownLayer | null {
  const layerMatches = parentMatches || matches(layer.name, query);
  const keep = ({ id, name }: { id: string; name: string }) =>
    (!onlyOn || !hiddenIds.has(id)) && (layerMatches || matches(name, query));
  if (layer.kind === "model") return keep(layer) ? { layer, points: [], trechos: [] } : null;
  const points = layer.points.filter(keep);
  const trechos = layer.trechos.filter(keep);
  // KMZ ainda sem elementos (convertendo) continua visível enquanto o nome casar
  const empty = points.length + trechos.length === 0;
  return empty && !(layerMatches && !onlyOn) ? null : { layer, points, trechos };
}

// query já em minúsculas; vazia = tudo
export function searchProjects(
  projects: Project[],
  query: string,
  onlyOn: boolean,
  hiddenIds: ReadonlySet<string>,
): ShownProject[] {
  return projects.flatMap((project) => {
    const projectMatches = matches(project.name, query);
    const layers = project.layers
      .map((layer) => searchLayer(layer, query, projectMatches, onlyOn, hiddenIds))
      .filter((shown) => shown !== null);
    const keep = layers.length > 0 || (projectMatches && !onlyOn);
    return keep ? [{ project, layers }] : [];
  });
}
