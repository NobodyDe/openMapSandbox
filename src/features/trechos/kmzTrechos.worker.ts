import { readKmz } from "../../lib/kmz";
import { featuresToTrechos } from "./kmzToTrechos";
import type { Trecho } from "./types";

export type WorkerResponse =
  | { ok: true; trechos: Trecho[] }
  | { ok: false; message: string };

self.onmessage = async (event: MessageEvent<File>) => {
  let response: WorkerResponse;
  try {
    response = {
      ok: true,
      trechos: featuresToTrechos(await readKmz(event.data)),
    };
  } catch (error) {
    response = { ok: false, message: (error as Error).message };
  }
  self.postMessage(response);
};
