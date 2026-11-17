import { useCallback, useState } from "react";
import { getGeoJson, type JobResult, type Placement } from "../conversion/api";
import { useConversionJobs } from "../conversion/useConversionJobs";
import { MODELS_3D, type Model3dConfig, type ModelFormat } from "../models3d/models";
import { geojsonToElements } from "./elements";
import type { Layer, LngLat, Project, ProjectInput } from "./types";

const [HFC_MODEL] = MODELS_3D;
const INITIAL_PROJECTS: Project[] = [
  {
    id: "hfc",
    name: "HFC — Fachada",
    date: "2026-11-16",
    location: { lng: -43.1895761, lat: -22.986445 },
    layers: [{ kind: "model", id: HFC_MODEL.id, name: HFC_MODEL.name, fileType: "FRAG", model: HFC_MODEL }],
  },
];

// Formato que o servidor devolve depois de converter cada extensão
const CONVERTED_FORMAT: Record<string, ModelFormat> = { ifc: "frag", glb: "glb", las: "pointcloud", laz: "pointcloud" };

// Um arquivo = uma camada. O .frag é lido no navegador (URL "blob:" aponta para o arquivo na memória);
// os outros entram vazios e se completam quando o servidor termina de converter
function layerFromFile(file: File): Layer {
  const id = crypto.randomUUID();
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const name = file.name.replace(/\.[^.]+$/, "");
  const fileType = extension.toUpperCase();
  if (extension === "kmz") return { kind: "kmz", id, name, fileType, points: [], trechos: [] };
  const model: Model3dConfig =
    extension === "frag"
      ? { id, name, format: "frag", url: URL.createObjectURL(file) }
      : { id, name, format: CONVERTED_FORMAT[extension] };
  return { kind: "model", id, name, fileType, model };
}

function needsServer(layer: Layer): boolean {
  return layer.kind === "kmz" || !layer.model.url;
}

// Cópia: o React só re-renderiza se a referência mudar. Também usado pelo painel (abertos/fechados)
export function toggleIn(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function hasLayer(project: Project, layerId: string): boolean {
  return project.layers.some((layer) => layer.id === layerId);
}

// Troca uma camada pelo resultado de `change`. Os outros projetos mantêm a referência (memo do painel)
function updateLayer(projects: Project[], layerId: string, change: (layer: Layer) => Layer): Project[] {
  return projects.map((project) =>
    hasLayer(project, layerId)
      ? { ...project, layers: project.layers.map((layer) => (layer.id === layerId ? change(layer) : layer)) }
      : project,
  );
}

// Projeto sem local adota o primeiro centro que chegar; depois disso o local só muda pela edição
function adoptWhere(projects: Project[], isTarget: (project: Project) => boolean, center: LngLat): Project[] {
  return projects.map((project) =>
    project.location === null && isTarget(project) ? { ...project, location: center } : project,
  );
}

// Nuvem com CRS conhecido já nasce no lugar certo; base no chão, porque o mapa não tem relevo
function placementFields(placement: Placement | undefined): Partial<Model3dConfig> {
  if (!placement) return {};
  const { position, bearingDeg, localOrigin } = placement;
  return { position, bearingDeg, localOrigin, altitude: 0 };
}

// Projetos → camadas → elementos, e o que está oculto no mapa
export function useProjects() {
  const [projects, setProjects] = useState(INITIAL_PROJECTS);
  // Um conjunto só para todos os elementos (os ids são únicos entre camadas). O modelo de exemplo
  // começa desligado: baixa vários MB, então só carrega quando o usuário pede
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(() => new Set([HFC_MODEL.id]));
  const [hiddenMarkers, setHiddenMarkers] = useState<ReadonlySet<string>>(() => new Set());

  // useCallback + atualização funcional: as funções nunca mudam, e as linhas do painel (memo)
  // não re-renderizam todas a cada clique
  const setHidden = useCallback((ids: string[], hidden: boolean) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (hidden) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);
  const toggle = useCallback((id: string) => setHiddenIds((prev) => toggleIn(prev, id)), []);
  const toggleMarker = useCallback((projectId: string) => setHiddenMarkers((prev) => toggleIn(prev, projectId)), []);

  const adoptLocation = useCallback((projectId: string, center: LngLat) => {
    setProjects((prev) => adoptWhere(prev, (project) => project.id === projectId, center));
  }, []);

  // Conversão pronta: a camada recebe os elementos (KMZ) ou a URL do modelo, e o projeto pode ganhar local
  const handleConverted = useCallback(async (layerId: string, { format, url, center, placement }: JobResult) => {
    if (format === "geojson") {
      const elements = geojsonToElements(layerId, await getGeoJson(url));
      setProjects((prev) => updateLayer(prev, layerId, (layer) => (layer.kind === "kmz" ? { ...layer, ...elements } : layer)));
    } else {
      const fields = { url, format, ...placementFields(placement) };
      setProjects((prev) =>
        updateLayer(prev, layerId, (layer) => (layer.kind === "model" ? { ...layer, model: { ...layer.model, ...fields } } : layer)),
      );
    }
    if (center) setProjects((prev) => adoptWhere(prev, (project) => hasLayer(project, layerId), center));
  }, []);
  const { activity, start, discard } = useConversionJobs(handleConverted);

  function createProject(input: ProjectInput): string {
    const id = crypto.randomUUID();
    setProjects((prev) => [...prev, { id, ...input, layers: [] }]);
    return id;
  }

  function updateProject(id: string, input: ProjectInput) {
    setProjects((prev) => prev.map((project) => (project.id === id ? { ...project, ...input } : project)));
  }

  // Cancela envios e conversões e apaga as pastas dos jobs no servidor
  function removeProject(id: string) {
    projects.find((project) => project.id === id)?.layers.forEach((layer) => discard(layer.id));
    setProjects((prev) => prev.filter((project) => project.id !== id));
  }

  function importFiles(projectId: string, files: File[]) {
    const layers = files.map(layerFromFile);
    setProjects((prev) =>
      prev.map((project) => (project.id === projectId ? { ...project, layers: [...project.layers, ...layers] } : project)),
    );
    layers.forEach((layer, index) => {
      if (needsServer(layer)) start(layer.id, files[index]);
    });
  }

  // useCallback: chega às linhas do painel (memo)
  const removeLayer = useCallback(
    (layerId: string) => {
      setProjects((prev) =>
        prev.map((project) =>
          hasLayer(project, layerId)
            ? { ...project, layers: project.layers.filter((layer) => layer.id !== layerId) }
            : project,
        ),
      );
      discard(layerId);
    },
    [discard],
  );

  return {
    projects,
    hiddenIds,
    hiddenMarkers,
    activity,
    toggle,
    setHidden,
    toggleMarker,
    createProject,
    updateProject,
    removeProject,
    importFiles,
    removeLayer,
    adoptLocation,
  };
}

export type ProjectsState = ReturnType<typeof useProjects>;
