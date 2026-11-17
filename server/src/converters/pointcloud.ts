import { spawn } from "node:child_process";
import { readLasGeoref, type LasGeoref } from "../georef/lasHeader.ts";
import type { ConversionOutput } from "../jobs/types.ts";
import type { Converter } from "./index.ts";

// O PotreeConverter escreve linhas como "[ 37%, 1m 12s], [INDEXING: ...]"; o primeiro número é o total
const PROGRESS_PATTERN = /\[\s*(\d+)%/g;

function lastPercent(text: string): number | null {
  const matches = [...text.matchAll(PROGRESS_PATTERN)];
  const last = matches.at(-1);
  return last ? Number(last[1]) / 100 : null;
}

// Binário C++ externo: gera metadata.json, hierarchy.bin e octree.bin, que o navegador lê por Range
function runPotreeConverter(
  converterPath: string,
  inputPath: string,
  outDir: string,
  onProgress: (progress: number | null) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(converterPath, [inputPath, "-o", outDir], { signal }); // abortar mata o processo
    let lastLine = "";
    onProgress(null);
    child.stdout.on("data", (data: Buffer) => {
      const text = data.toString();
      const percent = lastPercent(text);
      if (percent !== null) onProgress(percent);
      lastLine = text.trim().split("\n").at(-1) ?? lastLine;
    });
    child.stderr.on("data", (data: Buffer) => (lastLine = data.toString().trim()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`PotreeConverter falhou (código ${code}): ${lastLine}`));
    });
  });
}

// Posição pelo CRS do cabeçalho. CRS desconhecido: a nuvem nasce no local do projeto e o usuário ajusta
function placementOf({ localOrigin, position, bearingDeg = 0, unknownEpsg }: LasGeoref): Omit<ConversionOutput, "format" | "file"> {
  if (!position) {
    return { center: null, warning: `CRS EPSG:${unknownEpsg} não reconhecido. Ajuste a posição na calibração.` };
  }
  return { center: position, placement: { position, bearingDeg, localOrigin } };
}

export function pointCloudConverter(converterPath: string | undefined): Converter {
  return async (inputPath, outDir, onProgress, signal) => {
    if (!converterPath) throw new Error("PotreeConverter não encontrado. Defina POTREE_CONVERTER_PATH.");
    const georef = await readLasGeoref(inputPath); // antes: o original é apagado ao fim da conversão
    await runPotreeConverter(converterPath, inputPath, outDir, onProgress, signal);
    return { format: "pointcloud", file: "metadata.json", ...placementOf(georef) };
  };
}
