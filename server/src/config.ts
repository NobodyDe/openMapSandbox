import { tmpdir } from "node:os";
import { join } from "node:path";

export interface Config {
  port: number;
  tmpRoot: string; // cada job ganha uma pasta aqui dentro
  potreeConverterPath: string | undefined; // sem ele, só a nuvem de pontos falha
  distDir: string; // frontend compilado, servido fora do desenvolvimento
}

export function readConfig(env: NodeJS.ProcessEnv): Config {
  return {
    port: Number(env.PORT ?? 3334),
    tmpRoot: env.TMP_ROOT ?? join(tmpdir(), "openmapsandbox-jobs"),
    potreeConverterPath: env.POTREE_CONVERTER_PATH,
    distDir: join(import.meta.dirname, "..", "..", "dist"),
  };
}
