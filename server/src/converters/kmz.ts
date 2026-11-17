import { join } from "node:path";
import { Worker } from "node:worker_threads";
import type { LngLat } from "../jobs/types.ts";
import type { Converter } from "./index.ts";

const OUTPUT_FILE = "layer.geojson";

// Thread separada: ler um XML grande ocupa a CPU e travaria envios e downloads.
// Cancelar = encerrar a thread
export const convertKmz: Converter = (inputPath, outDir, onProgress, signal) => {
  const worker = new Worker(new URL("./kmzWorker.ts", import.meta.url), {
    workerData: { inputPath, outputPath: join(outDir, OUTPUT_FILE) },
  });
  const terminate = () => void worker.terminate();
  signal.addEventListener("abort", terminate, { once: true });
  onProgress(null);

  return new Promise((resolve, reject) => {
    let center: LngLat | null = null;
    let failure: Error | undefined;
    // Só a mensagem com o centro: com `node --watch`, o próprio Node manda outras por esta porta
    worker.on("message", (message: { center?: LngLat | null }) => {
      if (message?.center !== undefined) center = message.center;
    });
    worker.on("error", (error) => {
      console.error(error);
      failure = error;
    });
    worker.on("exit", (code) => {
      signal.removeEventListener("abort", terminate);
      if (code === 0) resolve({ format: "geojson", file: OUTPUT_FILE, center });
      else reject(new Error(signal.aborted ? "Conversão cancelada." : (failure?.message ?? "Não foi possível ler o KMZ.")));
    });
  });
};
