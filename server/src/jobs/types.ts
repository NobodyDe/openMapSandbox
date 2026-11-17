export type JobState = "uploading" | "queued" | "converting" | "done" | "error";
export type ResultFormat = "geojson" | "frag" | "glb" | "pointcloud";

export interface LngLat {
  lng: number;
  lat: number;
}

// Posição lida do próprio arquivo (hoje só a nuvem, pelo CRS do LAS)
export interface Placement {
  position: LngLat;
  bearingDeg: number;
  localOrigin: [number, number, number];
}

// O que cada conversor devolve: file = arquivo principal dentro de outDir
export interface ConversionOutput {
  format: ResultFormat;
  file: string;
  center: LngLat | null; // vira o local de um projeto que ainda não tem um
  placement?: Placement;
  warning?: string;
}

export interface JobResult extends Omit<ConversionOutput, "file"> {
  url: string;
}

export interface JobStatus {
  state: JobState;
  progress: number | null; // 0 a 1, ou null quando o conversor não informa
  message?: string;
  result?: JobResult;
}
