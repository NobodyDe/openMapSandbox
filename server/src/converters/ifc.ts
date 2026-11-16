import { closeSync, openSync } from "node:fs";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import type { Converter } from "./index.ts";

const IFC_ERROR =
  "Não foi possível converter o IFC. Arquivos muito grandes passam do limite de memória do conversor (4 GB).";

// Thread separada: o IfcImporter ocupa a CPU por minutos e travaria as rotas do servidor.
// Cancelar = encerrar a thread, que é o único jeito de parar o WASM no meio
export const convertIfc: Converter = (inputPath, outDir, onProgress, signal) => {
  // Aberto aqui, e não na thread: encerrar a thread não fecharia o arquivo
  const fd = openSync(inputPath, "r");
  const worker = new Worker(new URL("./ifcWorker.ts", import.meta.url), {
    workerData: { fd, outputPath: join(outDir, "model.frag") },
  });
  const terminate = () => void worker.terminate();
  signal.addEventListener("abort", terminate, { once: true });
  onProgress(null);

  return new Promise((resolve, reject) => {
    worker.on("message", (progress: number) => onProgress(progress));
    worker.on("error", (error) => console.error(error)); // a causa real fica no log; o usuário vê IFC_ERROR
    worker.on("exit", (code) => {
      closeSync(fd);
      signal.removeEventListener("abort", terminate);
      if (code === 0) resolve({ format: "frag", file: "model.frag" });
      else reject(new Error(signal.aborted ? "Conversão cancelada." : IFC_ERROR));
    });
  });
};
