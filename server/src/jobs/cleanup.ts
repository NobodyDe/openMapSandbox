import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

// Sem storage permanente: o resultado de uma conversão vale por um tempo e depois some do disco
export async function removeOldJobDirs(tmpRoot: string, maxAgeMs: number): Promise<void> {
  const entries = await readdir(tmpRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = join(tmpRoot, entry.name);
    const { mtimeMs } = await stat(dir);
    if (Date.now() - mtimeMs > maxAgeMs) await rm(dir, { recursive: true, force: true });
  }
}
