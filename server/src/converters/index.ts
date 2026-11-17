import type { Config } from "../config.ts";
import type { ConversionOutput } from "../jobs/types.ts";
import { convertGlb } from "./glb.ts";
import { convertIfc } from "./ifc.ts";
import { pointCloudConverter } from "./pointcloud.ts";

// Mesma assinatura para todo formato: a fila não precisa saber qual conversor está rodando
export type Converter = (
  inputPath: string,
  outDir: string,
  onProgress: (progress: number | null) => void, // 0 a 1, ou null se desconhecido
  signal: AbortSignal,
) => Promise<ConversionOutput>;

export function converterFor(ext: string, config: Config): Converter {
  const pointCloud = pointCloudConverter(config.potreeConverterPath);
  const converters: Record<string, Converter> = {
    ".las": pointCloud,
    ".laz": pointCloud,
    ".ifc": convertIfc,
    ".glb": convertGlb,
  };
  const converter = converters[ext];
  if (!converter) throw new Error(`Sem conversor para ${ext}.`);
  return converter;
}
