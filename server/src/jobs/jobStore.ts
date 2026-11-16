import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { JobStatus } from "./types.ts";

export interface Job {
  id: string;
  ext: string; // com o ponto e minúscula: ".las"
  size: number;
  received: Set<number>; // índices dos pedaços já gravados
  status: JobStatus;
  dir: string;
  inputPath: string;
  outDir: string;
}

export type JobStore = ReturnType<typeof createJobStore>;

// Só em memória: sem storage permanente, um job não sobrevive a um reinício do servidor
export function createJobStore(tmpRoot: string) {
  const jobs = new Map<string, Job>();

  async function create(name: string, size: number): Promise<Job> {
    const id = randomUUID();
    const ext = extname(name).toLowerCase();
    const dir = join(tmpRoot, id);
    const job: Job = {
      id,
      ext,
      size,
      received: new Set(),
      status: { state: "uploading", progress: null },
      dir,
      inputPath: join(dir, `input${ext}`),
      outDir: join(dir, "out"),
    };
    await mkdir(job.outDir, { recursive: true });
    await writeFile(job.inputPath, ""); // os pedaços gravam por offset, com o arquivo já existindo
    jobs.set(id, job);
    return job;
  }

  // Só apaga pastas de jobs conhecidos: o id vem da URL e não pode virar um caminho qualquer
  async function remove(id: string): Promise<void> {
    const job = jobs.get(id);
    if (!job) return;
    jobs.delete(id);
    // maxRetries: no Windows o processo do conversor recém-encerrado ainda segura arquivos por um instante
    await rm(job.dir, { recursive: true, force: true, maxRetries: 5 });
  }

  return { create, get: (id: string) => jobs.get(id), remove };
}
