import { createWriteStream } from "node:fs";
import { extname } from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { Job, JobStore } from "./jobStore.ts";
import { SIGNATURES, hasValidSignature } from "./magicBytes.ts";
import type { Queue } from "./queue.ts";

const MAX_FILE_SIZE = 3 * 1024 ** 3;
const CHUNK_SIZE = 16 * 1024 ** 2;

const idParams = { type: "object", properties: { id: { type: "string" } } } as const;
const chunkParams = {
  type: "object",
  properties: { id: { type: "string" }, index: { type: "integer", minimum: 0 } },
} as const;
const createBody = {
  type: "object",
  required: ["name", "size"],
  properties: { name: { type: "string" }, size: { type: "integer", minimum: 1 } },
} as const;

function chunkCount(job: Job): number {
  return Math.ceil(job.size / CHUNK_SIZE);
}

// Todos os pedaços têm CHUNK_SIZE, menos o último
function expectedChunkSize(job: Job, index: number): number {
  return Math.min(CHUNK_SIZE, job.size - index * CHUNK_SIZE);
}

function fail(reply: FastifyReply, statusCode: number, message: string) {
  return reply.code(statusCode).send({ message });
}

function notFound(reply: FastifyReply) {
  return fail(reply, 404, "Envio não encontrado.");
}

// Grava o corpo no offset do pedaço sem guardá-lo inteiro na memória. Para no primeiro byte
// além do esperado: passar dali escreveria em cima do pedaço seguinte
async function writeChunk(body: Readable, path: string, start: number, maxBytes: number): Promise<number> {
  let written = 0;
  await pipeline(
    body,
    async function* (source: AsyncIterable<Buffer>) {
      for await (const data of source) {
        written += data.length;
        if (written > maxBytes) throw Object.assign(new Error("Pedaço maior que o esperado."), { statusCode: 400 });
        yield data;
      }
    },
    createWriteStream(path, { flags: "r+", start }),
  );
  return written;
}

export function registerJobRoutes(app: FastifyInstance, store: JobStore, queue: Queue): void {
  // O corpo dos pedaços chega como stream em request.raw; sem isto o Fastify recusa o tipo (415)
  app.addContentTypeParser("application/octet-stream", (_request, _payload, done) => done(null));

  app.post<{ Body: { name: string; size: number } }>("/api/jobs", { schema: { body: createBody } }, async (request, reply) => {
    const { name, size } = request.body;
    if (!(extname(name).toLowerCase() in SIGNATURES)) {
      return fail(reply, 400, "Formato não aceito. Use .las, .laz, .ifc ou .glb.");
    }
    if (size > MAX_FILE_SIZE) return fail(reply, 400, "O arquivo passa do limite de 3 GB.");
    const job = await store.create(name, size);
    return { jobId: job.id, chunkSize: CHUNK_SIZE };
  });

  app.put<{ Params: { id: string; index: number } }>(
    "/api/jobs/:id/chunks/:index",
    { schema: { params: chunkParams } },
    async (request, reply) => {
      const job = store.get(request.params.id);
      if (!job) return notFound(reply);
      if (job.status.state !== "uploading") return fail(reply, 409, "O envio deste arquivo já terminou.");
      const { index } = request.params;
      if (index >= chunkCount(job)) return fail(reply, 400, "Pedaço fora do tamanho do arquivo.");
      const expected = expectedChunkSize(job, index);
      const written = await writeChunk(request.raw, job.inputPath, index * CHUNK_SIZE, expected);
      // Um pedaço curto deixaria um buraco no arquivo; o cliente reenvia
      if (written !== expected) return fail(reply, 400, "Pedaço incompleto.");
      job.received.add(index); // Set: repetir o mesmo pedaço não conta duas vezes
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { id: string } }>("/api/jobs/:id/convert", { schema: { params: idParams } }, async (request, reply) => {
    const job = store.get(request.params.id);
    if (!job) return notFound(reply);
    if (job.status.state !== "uploading") return fail(reply, 409, "A conversão deste arquivo já começou.");
    if (job.received.size < chunkCount(job)) return fail(reply, 409, "Ainda faltam pedaços do arquivo.");
    if (!(await hasValidSignature(job.inputPath, job.ext))) {
      return fail(reply, 400, `O arquivo não é um ${job.ext.slice(1).toUpperCase()} válido.`);
    }
    job.status = { state: "queued", progress: null };
    queue.enqueue(job);
    return reply.code(204).send();
  });

  app.get<{ Params: { id: string } }>("/api/jobs/:id", { schema: { params: idParams } }, async (request, reply) => {
    const job = store.get(request.params.id);
    return job ? job.status : notFound(reply);
  });

  app.delete<{ Params: { id: string } }>("/api/jobs/:id", { schema: { params: idParams } }, async (request, reply) => {
    queue.cancel(request.params.id);
    await store.remove(request.params.id);
    return reply.code(204).send();
  });

  // sendFile (do @fastify/static) cuida de Range e recusa caminhos que saem de outDir
  app.get<{ Params: { id: string; "*": string } }>("/api/jobs/:id/files/*", async (request, reply) => {
    const job = store.get(request.params.id);
    if (!job) return notFound(reply);
    return reply.sendFile(request.params["*"], job.outDir);
  });
}
