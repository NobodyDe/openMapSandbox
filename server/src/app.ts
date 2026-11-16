import { rm } from "node:fs/promises";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import type { Config } from "./config.ts";
import { converterFor } from "./converters/index.ts";
import { createJobStore, type Job } from "./jobs/jobStore.ts";
import { registerJobRoutes } from "./jobs/jobRoutes.ts";
import { createQueue } from "./jobs/queue.ts";

// Ciclo de um job ao sair da fila: convertendo → pronto (sem o arquivo original) ou erro.
// Nunca lança: o erro vira estado do job, que o frontend mostra na linha do item
function jobConverter(config: Config) {
  return async (job: Job, signal: AbortSignal): Promise<void> => {
    job.status = { state: "converting", progress: null };
    try {
      const convert = converterFor(job.ext, config);
      const onProgress = (progress: number | null) => (job.status.progress = progress);
      const { format, file } = await convert(job.inputPath, job.outDir, onProgress, signal);
      await rm(job.inputPath, { force: true }); // o original não é mais lido; libera o disco
      job.status = { state: "done", progress: 1, result: { format, url: `/api/jobs/${job.id}/files/${file}` } };
    } catch (error) {
      console.error(error);
      job.status = { state: "error", progress: null, message: (error as Error).message };
    }
  };
}

// Separado do index.ts para o teste montar o servidor sem abrir porta
export function buildApp(config: Config): FastifyInstance {
  const app = Fastify();
  // serve: false — só traz o reply.sendFile; cada job diz de qual pasta servir
  app.register(fastifyStatic, { root: config.tmpRoot, serve: false });
  registerJobRoutes(app, createJobStore(config.tmpRoot), createQueue(jobConverter(config)));
  return app;
}
