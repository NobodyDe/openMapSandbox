import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { jobPaths } from "./jobPaths.ts";

export interface Job {
  id: string;
  ext: string; // com o ponto e minúscula: ".las"
  size: number;
  received: Set<number>; // índices dos pedaços já gravados
  inputPath: string;
}

export type JobStore = ReturnType<typeof createJobStore>;

// Só a fase de envio, em memória. Depois do convert o job passa para a fila (Redis)
export function createJobStore(tmpRoot: string) {
  const jobs = new Map<string, Job>();

  async function create(name: string, size: number): Promise<Job> {
    const id = randomUUID();
    const ext = extname(name).toLowerCase();
    const paths = jobPaths(tmpRoot, id);
    const job: Job = { id, ext, size, received: new Set(), inputPath: paths.inputPath(ext) };
    await mkdir(paths.outDir, { recursive: true });
    await writeFile(job.inputPath, ""); // os pedaços gravam por offset, com o arquivo já existindo
    jobs.set(id, job);
    return job;
  }

  return { create, get: (id: string) => jobs.get(id), delete: (id: string) => jobs.delete(id) };
}
