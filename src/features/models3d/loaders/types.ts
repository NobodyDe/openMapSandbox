import type { Object3D, PerspectiveCamera, WebGLRenderer } from "three";
import type { LoadableModel } from "../models";

// O que a camada do mapa precisa de um modelo, qualquer que seja o formato do arquivo
export interface LoadedModel {
  object: Object3D; // em metros, Y para cima, −Z = norte
  site?: { lng: number; lat: number } | null; // só o .frag preenche (IfcSite)
  // Chamado a cada quadro: Fragments e nuvem escolhem ali o nível de detalhe
  update?(lodCamera: PerspectiveCamera, renderer: WebGLRenderer): void;
  dispose(): void | Promise<void>;
}

export type Loader = (config: LoadableModel, signal: AbortSignal) => Promise<LoadedModel>;
