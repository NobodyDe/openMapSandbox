import { closeSync, openSync } from "node:fs";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { readIfcSite } from "../georef/ifcSite.ts";
import type { Converter } from "./index.ts";

const IFC_ERROR =
  "Não foi possível converter o IFC. Arquivos muito grandes passam do limite de memória do conversor (4 GB).";

// Thread separada: o IfcImporter ocupa a CPU por minutos e travaria as rotas do servidor.
// Cancelar = encerrar a thread, que é o único jeito de parar o WASM no meio
// O centro (IfcSite) é lido antes: o arquivo original é apagado ao fim da conversão
export const convertIfc: Converter = async (inputPath, outDir, onProgress, signal) => {
  const center = await readIfcSite(inputPath);
  // Aberto aqui, e não na thread: encerrar a thread não fecharia o arquivo
  const fd = openSync(inputPath, "r");
  const worker = new Worker(new URL("./ifcWorker.ts", import.meta.url), {
    workerData: { fd, outputPath: join(outDir, "model.frag") },
  });
  const terminate = () => void worker.terminate();
  signal.addEventListener("abort", terminate, { once: true });
  onProgress(null);

  return new Promise((resolve, reject) => {
    // Só números: com `node --watch`, o próprio Node manda mensagens { "watch:import" } por esta porta
    worker.on("message", (progress: unknown) => {
      if (typeof progress === "number") onProgress(progress);
    });
    worker.on("error", (error) => console.error(error)); // a causa real fica no log; o usuário vê IFC_ERROR
    worker.on("exit", (code) => {
      closeSync(fd);
      signal.removeEventListener("abort", terminate);
      if (code === 0) resolve({ format: "frag", file: "model.frag", center });
      else reject(new Error(signal.aborted ? "Conversão cancelada." : IFC_ERROR));
    });
  });
};
