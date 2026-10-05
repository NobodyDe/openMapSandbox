import type { MapPoint } from "../points/types";
import type { Trecho } from "../trechos/types";
import type { Model3dConfig } from "../models3d/models";

// O que cada tipo de pasta guarda
export interface FolderItems {
  points: MapPoint[];
  trechos: Trecho[];
  models: Model3dConfig[];
}

export type FolderKind = keyof FolderItems;
export type FolderItem = FolderItems[FolderKind][number];

// União discriminada: depois de `folder.kind === "points"`, o TS já sabe que items é MapPoint[]
export type LayerFolder = {
  [K in FolderKind]: { id: string; name: string; kind: K; items: FolderItems[K] };
}[FolderKind];
