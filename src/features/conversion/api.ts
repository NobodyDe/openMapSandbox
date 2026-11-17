import type { FeatureCollection } from "geojson";
import type { ModelFormat } from "../models3d/models";
import type { LngLat } from "../projects/types";

// Redeclarados aqui: frontend e servidor não compartilham código
export type JobState = "uploading" | "queued" | "converting" | "done" | "error";
export interface Placement {
  position: LngLat;
  bearingDeg: number;
  localOrigin: [number, number, number];
}
export interface JobResult {
  format: "geojson" | ModelFormat;
  url: string;
  center: LngLat | null; // vira o local de um projeto que ainda não tem um
  placement?: Placement; // só nuvem com CRS reconhecido
  warning?: string;
}
export interface JobStatus {
  state: JobState;
  progress: number | null; // 0 a 1, ou null quando o conversor não informa
  message?: string;
  result?: JobResult;
}

const UNAVAILABLE = "Servidor de conversão indisponível.";

// Falha de rede vira uma mensagem que o usuário entende. Cancelamento passa como está
async function send(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(path, init);
  } catch (error) {
    if (init?.signal?.aborted) throw error;
    throw new Error(UNAVAILABLE, { cause: error });
  }
}

// O servidor sempre responde erro com { message }. Sem isso, quem respondeu foi o proxy do
// Vite, porque o servidor está desligado
async function ensureOk(response: Response): Promise<Response> {
  if (response.ok) return response;
  const body: { message?: string } | null = await response.json().catch(() => null);
  throw new Error(body?.message ?? UNAVAILABLE);
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  return ensureOk(await send(path, init));
}

export async function createJob(name: string, size: number): Promise<{ jobId: string; chunkSize: number }> {
  const response = await request("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, size }),
  });
  return response.json();
}

export async function putChunk(jobId: string, index: number, chunk: Blob, signal: AbortSignal): Promise<void> {
  await request(`/api/jobs/${jobId}/chunks/${index}`, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: chunk,
    signal,
  });
}

export async function startConvert(jobId: string): Promise<void> {
  await request(`/api/jobs/${jobId}/convert`, { method: "POST" });
}

export async function getJob(jobId: string): Promise<JobStatus> {
  const response = await send(`/api/jobs/${jobId}`);
  // Envio interrompido por um reinício, ou job já apagado (passou de 24 h)
  if (response.status === 404) throw new Error("Envio não encontrado no servidor. Importe de novo.");
  return (await ensureOk(response)).json();
}

// Resultado de um KMZ convertido (layer.geojson)
export async function getGeoJson(url: string): Promise<FeatureCollection> {
  return (await request(url)).json();
}

export async function deleteJob(jobId: string): Promise<void> {
  await request(`/api/jobs/${jobId}`, { method: "DELETE" });
}
