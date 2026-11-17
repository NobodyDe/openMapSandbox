import { existsSync } from "node:fs";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import type { Config } from "./config.ts";
import { createConversionQueue } from "./jobs/conversionQueue.ts";
import { createJobStore } from "./jobs/jobStore.ts";
import { registerJobRoutes } from "./jobs/jobRoutes.ts";

// Separado do index.ts para o teste montar o servidor sem abrir porta
export function buildApp(config: Config): FastifyInstance {
  const app = Fastify();
  // serve: false — só traz o reply.sendFile; cada job diz de qual pasta servir
  app.register(fastifyStatic, { root: config.tmpRoot, serve: false });
  const queue = createConversionQueue(config);
  app.addHook("onClose", () => queue.close());
  registerJobRoutes(app, config.tmpRoot, createJobStore(config.tmpRoot), queue);
  // Fora do desenvolvimento, o próprio servidor entrega o frontend compilado: mesma origem, sem CORS.
  // decorateReply: false — o reply.sendFile já veio do registro acima
  if (existsSync(config.distDir)) app.register(fastifyStatic, { root: config.distDir, decorateReply: false });
  return app;
}
