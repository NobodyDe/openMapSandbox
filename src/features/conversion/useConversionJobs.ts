import { useCallback, useRef, useState } from "react";
import type { ModelActivity } from "../models3d/models";
import { createJob, deleteJob, getJob, startConvert, type JobResult, type JobStatus } from "./api";
import { uploadFile } from "./uploadFile";

const POLL_INTERVAL_MS = 2000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function formatDuration(seconds: number): string {
  return seconds < 60 ? `${Math.ceil(seconds)} s` : `${Math.ceil(seconds / 60)} min`;
}

// "Enviando 42% · 18 MB/s · faltam 1 min": velocidade média desde o início do envio
function uploadText(bytesSent: number, totalBytes: number, startedAt: number): string {
  const percent = Math.floor((bytesSent / totalBytes) * 100);
  const bytesPerSecond = bytesSent / ((performance.now() - startedAt) / 1000);
  const remaining = (totalBytes - bytesSent) / bytesPerSecond;
  return `Enviando ${percent}% · ${Math.round(bytesPerSecond / 1024 ** 2)} MB/s · faltam ${formatDuration(remaining)}`;
}

function conversionActivity({ state, progress }: JobStatus): ModelActivity {
  if (state === "queued") return { status: "queued", text: "Na fila…" };
  const text = progress === null ? "Convertendo…" : `Convertendo ${Math.floor(progress * 100)}%`;
  return { status: "converting", text };
}

interface TrackedJob {
  controller: AbortController;
  jobId?: string; // guardado mesmo depois de pronto: remover o item apaga a pasta no servidor
}

// Envio e conversão de cada item, do arquivo escolhido até a URL do resultado
export function useConversionJobs(onDone: (itemId: string, result: JobResult) => Promise<void>) {
  const [activity, setActivity] = useState<Record<string, ModelActivity>>({});
  const jobs = useRef(new Map<string, TrackedJob>());

  const setItemActivity = useCallback((itemId: string, next: ModelActivity | null) => {
    setActivity((prev) => {
      const copy = { ...prev };
      if (next) copy[itemId] = next;
      else delete copy[itemId];
      return copy;
    });
  }, []);

  // Consulta o job a cada 2 s até terminar; devolve o resultado ou lança a mensagem do servidor
  async function waitForResult(itemId: string, jobId: string, signal: AbortSignal): Promise<JobResult | null> {
    while (!signal.aborted) {
      const status = await getJob(jobId);
      if (status.state === "done" && status.result) return status.result;
      if (status.state === "error") throw new Error(status.message ?? "Erro na conversão.");
      setItemActivity(itemId, conversionActivity(status));
      await wait(POLL_INTERVAL_MS);
    }
    return null;
  }

  async function run(itemId: string, file: File, tracked: TrackedJob): Promise<void> {
    const { signal } = tracked.controller;
    setItemActivity(itemId, { status: "uploading", text: "Enviando 0%" });
    const { jobId, chunkSize } = await createJob(file.name, file.size);
    tracked.jobId = jobId;
    const startedAt = performance.now();
    const onProgress = (bytesSent: number) =>
      setItemActivity(itemId, { status: "uploading", text: uploadText(bytesSent, file.size, startedAt) });
    await uploadFile(file, jobId, chunkSize, onProgress, signal);
    await startConvert(jobId);
    const result = await waitForResult(itemId, jobId, signal);
    if (!result) return; // descartado durante a conversão
    await onDone(itemId, result); // o KMZ ainda baixa o GeoJSON aqui; uma falha vira erro na linha
    // O aviso (CRS desconhecido) fica na linha; sem aviso, a linha volta ao normal
    setItemActivity(itemId, result.warning ? { status: "ready", text: result.warning } : null);
  }

  // Não é useCallback: só é chamado no clique de importar, nunca vai para um memo
  function start(itemId: string, file: File): void {
    const tracked: TrackedJob = { controller: new AbortController() };
    jobs.current.set(itemId, tracked);
    run(itemId, file, tracked).catch((error: Error) => {
      if (tracked.controller.signal.aborted) return; // descartado pelo usuário: não é falha
      tracked.controller.abort(); // para os outros pedaços que ainda estavam subindo
      setItemActivity(itemId, { status: "error", text: error.message });
    });
  }

  // useCallback: chega às linhas do painel (memo) pelo removeItem
  const discard = useCallback(
    (itemId: string) => {
      const tracked = jobs.current.get(itemId);
      jobs.current.delete(itemId);
      setItemActivity(itemId, null);
      if (!tracked) return;
      tracked.controller.abort();
      if (tracked.jobId) deleteJob(tracked.jobId).catch(console.error);
    },
    [setItemActivity],
  );

  return { activity, start, discard };
}
