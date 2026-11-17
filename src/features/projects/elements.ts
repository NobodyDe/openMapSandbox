import type { FeatureCollection, LineString, MultiLineString, Point } from "geojson";
import type { Model3dConfig } from "../models3d/models";
import type { MapPoint } from "../points/types";
import type { Trecho } from "../trechos/types";
import type { Layer, Project } from "./types";

// O que o servidor grava em cada feição do layer.geojson (conversor de KMZ)
interface ElementProperties {
  kind: "point" | "line";
  name: string;
  color: string;
  attributes: Record<string, string>;
  extensaoKm?: number;
}

// Elementos = o que tem olho próprio. Um modelo ou nuvem é um elemento só: a própria camada
export function elementIds(layer: Layer): string[] {
  if (layer.kind === "model") return [layer.id];
  return [...layer.points, ...layer.trechos].map((element) => element.id);
}

export function projectElementIds(project: Project): string[] {
  return project.layers.flatMap(elementIds);
}

// O mapa continua recebendo três listas planas: as camadas de desenho não sabem de projetos
export function mapItems(projects: Project[]): { points: MapPoint[]; trechos: Trecho[]; models: Model3dConfig[] } {
  const layers = projects.flatMap((project) => project.layers);
  return {
    points: layers.flatMap((layer) => (layer.kind === "kmz" ? layer.points : [])),
    trechos: layers.flatMap((layer) => (layer.kind === "kmz" ? layer.trechos : [])),
    models: layers.flatMap((layer) => (layer.kind === "model" ? [layer.model] : [])),
  };
}

// Ids prefixados com a camada: o índice sozinho colidiria entre dois KMZ na visibilidade, no hover e no popup
export function geojsonToElements(
  layerId: string,
  collection: FeatureCollection,
): { points: MapPoint[]; trechos: Trecho[] } {
  const points: MapPoint[] = [];
  const trechos: Trecho[] = [];
  collection.features.forEach((feature, index) => {
    const id = `${layerId}/${index}`;
    const { kind, name, color, attributes, extensaoKm = 0 } = feature.properties as ElementProperties;
    if (kind === "point") {
      const [lng, lat] = (feature.geometry as Point).coordinates;
      points.push({ id, name, color, attributes, lng, lat });
    } else {
      trechos.push({ id, name, color, attributes, extensaoKm, geometry: feature.geometry as LineString | MultiLineString });
    }
  });
  return { points, trechos };
}
