import type { Trecho } from "./types";
import type { WorkerResponse } from "./kmzTrechos.worker";

export function importTrechosKmz(file: File): Promise<Trecho[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./kmzTrechos.worker.ts", import.meta.url),
      { type: "module" },
    );

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      worker.terminate(); // libera as centenas de MB que o XML ocupou
      if (event.data.ok) resolve(event.data.trechos);
      else reject(new Error(event.data.message));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message));
    };

    worker.postMessage(file);
  });
}
