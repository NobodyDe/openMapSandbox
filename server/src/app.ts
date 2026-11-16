import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import type { Config } from "./config.ts";
import { createJobStore } from "./jobs/jobStore.ts";
import { registerJobRoutes } from "./jobs/jobRoutes.ts";

// Separado do index.ts para o teste montar o servidor sem abrir porta
export function buildApp(config: Config): FastifyInstance {
  const app = Fastify();
  // serve: false — só traz o reply.sendFile; cada job diz de qual pasta servir
  app.register(fastifyStatic, { root: config.tmpRoot, serve: false });
  registerJobRoutes(app, createJobStore(config.tmpRoot));
  return app;
}
