import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "../src/app.ts";

// Precisa do Redis no ar (docker compose up -d redis): o app monta a fila ao ser criado
test("/files não sai da pasta out/ do job", async () => {
  const tmpRoot = await mkdtemp(join(tmpdir(), "jobs-"));
  const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6380";
  const app = buildApp({ port: 0, tmpRoot, potreeConverterPath: undefined, distDir: join(tmpRoot, "sem-dist"), redisUrl });
  const created = await app.inject({ method: "POST", url: "/api/jobs", payload: { name: "a.glb", size: 4 } });
  const { jobId } = created.json();
  await writeFile(join(tmpRoot, jobId, "out", "ok.txt"), "ok");
  await writeFile(join(tmpRoot, jobId, "segredo.txt"), "fora de out/");

  assert.equal((await app.inject(`/api/jobs/${jobId}/files/ok.txt`)).statusCode, 200);
  for (const path of ["../segredo.txt", "..%2Fsegredo.txt", "%2e%2e/segredo.txt", "..%5Csegredo.txt"]) {
    assert.notEqual((await app.inject(`/api/jobs/${jobId}/files/${path}`)).statusCode, 200, path);
  }
  assert.equal((await app.inject("/api/jobs/nao-existe/files/ok.txt")).statusCode, 404);
  await app.close(); // fecha a conexão com o Redis; sem isso o teste não termina
});
