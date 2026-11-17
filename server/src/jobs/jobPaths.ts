import { join } from "node:path";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// O id vem da URL: só um UUID pode virar nome de pasta
export function isJobId(id: string): boolean {
  return UUID_PATTERN.test(id);
}

// Único lugar que monta caminhos de job. Sai só do id: depois de um reinício não há memória para consultar
export function jobPaths(tmpRoot: string, id: string) {
  const dir = join(tmpRoot, id);
  return {
    dir,
    outDir: join(dir, "out"),
    inputPath: (ext: string) => join(dir, `input${ext}`),
  };
}
