import type { Model3dConfig } from "../models3d/models";
import type { MapPoint } from "../points/types";
import type { Trecho } from "../trechos/types";

export interface LngLat {
  lng: number;
  lat: number;
}

// Um arquivo importado. fileType é só para a etiqueta do painel ("KMZ", "IFC", "LAS"…):
// depois de convertido, um IFC vira "frag" e o formato sozinho não diz de onde veio
export type Layer =
  | { kind: "kmz"; id: string; name: string; fileType: string; points: MapPoint[]; trechos: Trecho[] }
  | { kind: "model"; id: string; name: string; fileType: string; model: Model3dConfig }; // model.id === id

export interface Project {
  id: string;
  name: string;
  date: string; // AAAA-MM-DD
  location: LngLat | null; // null até o usuário marcar ou a primeira camada com centro chegar
  layers: Layer[];
}

export interface ProjectInput {
  name: string;
  date: string;
  location: LngLat | null;
}
