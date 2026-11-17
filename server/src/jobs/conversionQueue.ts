import { rm } from "node:fs/promises";
import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import type { Config } from "../config.ts";
import { converterFor } from "../converters/index.ts";
import { jobPaths } from "./jobPaths.ts";
import type { JobResult, JobStatus } from "./types.ts";

const QUEUE_NAME = "conversions";
const DAY_S = 24 * 60 * 60; // alinhado com a limpeza das pastas
const UNAVAILABLE = "Fila de conversão indisponível. Verifique o Redis.";

interface ConversionData {
  ext: string;
}

type ConversionJob = Job<ConversionData, JobResult>;

export interface ConversionQueue {
  add(jobId: string, ext: string): Promise<void>;
  status(jobId: string): Promise<JobStatus | null>; // null = a fila não conhece o job
  cancel(jobId: string): Promise<void>;
  close(): Promise<void>;
}

// O conversor de IFC informa milhares de vezes; cada aviso é uma ida ao Redis, então só passa quando muda 1%
function progressReporter(job: ConversionJob) {
  let lastPercent = -1;
  return (progress: number | null) => {
    if (progress === null) return;
    const percent = Math.round(progress * 100);
    if (percent === lastPercent) return;
    lastPercent = percent;
    job.updateProgress(progress).catch(console.error); // job cancelado no meio: não derruba o processo
  };
}

// Converte, apaga o original (não é mais lido; libera o disco) e devolve o resultado, que fica no Redis
function conversionProcessor(config: Config) {
  return async (job: ConversionJob, _token?: string, signal?: AbortSignal): Promise<JobResult> => {
    const id = job.id!; // sempre o UUID do envio (ver add)
    const paths = jobPaths(config.tmpRoot, id);
    const inputPath = paths.inputPath(job.data.ext);
    const convert = converterFor(job.data.ext, config);
    // signal!: o BullMQ 6 sempre passa o sinal; é ele que o worker.cancelJob dispara
    const { file, ...output } = await convert(inputPath, paths.outDir, progressReporter(job), signal!);
    await rm(inputPath, { force: true });
    return { ...output, url: `/api/jobs/${id}/files/${file}` };
  };
}

function toStatus(job: ConversionJob, state: string): JobStatus {
  if (state === "active") {
    const progress = typeof job.progress === "number" && job.progress > 0 ? job.progress : null;
    return { state: "converting", progress };
  }
  if (state === "completed") return { state: "done", progress: 1, result: job.returnvalue };
  if (state === "failed") return { state: "error", progress: null, message: job.failedReason };
  return { state: "queued", progress: null }; // waiting, delayed, prioritized
}

function unavailable(): Error {
  return Object.assign(new Error(UNAVAILABLE), { statusCode: 503 });
}

// Sem Redis, o BullMQ espera a conexão para sempre (e a rota nunca responde); aqui falha na hora,
// com uma frase que diz ao usuário o que fazer no lugar do erro técnico do cliente
async function orUnavailable<T>(client: Redis, work: () => Promise<T>): Promise<T> {
  if (client.status !== "ready") throw unavailable();
  try {
    return await work();
  } catch (error) {
    console.error(error);
    throw unavailable();
  }
}

// API e worker no mesmo processo, uma conversão por vez: duas conversões de 4 GB juntas derrubam a máquina.
// Conversão interrompida por queda do processo volta sozinha para a fila quando o servidor sobe (job travado)
export function createConversionQueue(config: Config): ConversionQueue {
  // O BullMQ 6 em ESM não cria o cliente Redis sozinho: recebe um pronto e não o fecha (ver close).
  // enableOfflineQueue: false — se a conexão cair no meio de um comando, ele falha em vez de esperar
  const queueClient = new Redis(config.redisUrl, { enableOfflineQueue: false });
  const workerClient = new Redis(config.redisUrl, { maxRetriesPerRequest: null }); // exigido pelo Worker
  const queue = new Queue<ConversionData, JobResult>(QUEUE_NAME, { connection: queueClient });
  const worker = new Worker<ConversionData, JobResult>(QUEUE_NAME, conversionProcessor(config), {
    connection: workerClient,
    concurrency: 1,
  });
  // Sem estes ouvintes, um Redis desligado derrubaria o processo, e o servidor tem de subir mesmo assim
  queue.on("error", (error) => console.error(`Fila: ${error.message}`));
  worker.on("error", (error) => console.error(`Worker: ${error.message}`));
  worker.on("failed", (_job, error) => console.error(error));

  async function add(jobId: string, ext: string): Promise<void> {
    const options = { jobId, attempts: 1, removeOnComplete: { age: DAY_S }, removeOnFail: { age: DAY_S } };
    await orUnavailable(queueClient, () => queue.add("convert", { ext }, options));
  }

  async function status(jobId: string): Promise<JobStatus | null> {
    return orUnavailable(queueClient, async () => {
      const job = await queue.getJob(jobId);
      return job ? toStatus(job, await job.getState()) : null;
    });
  }

  // Em andamento: o cancelJob dispara o AbortSignal do conversor. Na fila ou já terminado: sai do Redis
  async function cancel(jobId: string): Promise<void> {
    if (worker.cancelJob(jobId, "Conversão cancelada.")) return;
    await orUnavailable(queueClient, async () => (await queue.getJob(jobId))?.remove());
  }

  async function close(): Promise<void> {
    await worker.close();
    await queue.close();
    queueClient.disconnect();
    workerClient.disconnect();
  }

  return { add, status, cancel, close };
}
