import { mkdir } from "node:fs/promises";
import { buildApp } from "./app.ts";
import { readConfig } from "./config.ts";
import { removeOldJobDirs } from "./jobs/cleanup.ts";

const HOUR_MS = 60 * 60 * 1000;
const JOB_MAX_AGE_MS = 24 * HOUR_MS;

const config = readConfig(process.env);
await mkdir(config.tmpRoot, { recursive: true });

const cleanup = () => removeOldJobDirs(config.tmpRoot, JOB_MAX_AGE_MS).catch(console.error);
await cleanup();
setInterval(cleanup, HOUR_MS);

const app = buildApp(config);
await app.listen({ port: config.port });
console.log(`Servidor de conversão em http://localhost:${config.port}`);
