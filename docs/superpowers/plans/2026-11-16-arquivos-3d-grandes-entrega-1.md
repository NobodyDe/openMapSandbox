# Arquivos 3D grandes — Entrega 1 (upload, conversão, objeto no mapa) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Decisão do Henrique: um único agente rodando Opus 5.5 aplica o código, seguindo a skill `simple-solid-code`. Sem agente de revisão por tarefa.

**Goal:** O usuário escolhe um `.las`/`.laz`, `.ifc` ou `.glb` de até 3 GB no painel de camadas, acompanha envio e conversão, e vê o objeto no mapa na posição certa.

**Architecture:** Um servidor Node em `server/` recebe o arquivo em pedaços, converte um job por vez numa pasta temporária e serve o resultado com Range. O frontend ganha um carregador por formato atrás de uma interface única, desenhado pela mesma camada custom do MapLibre que já existe. Toda a georreferência fica no frontend.

**Tech Stack:** Node 24 (TypeScript executado direto, sem build), Fastify, `@fastify/static`, `@thatopen/fragments` 3.4.7, `web-ifc` 0.0.78, `gltf-transform`, binário `PotreeConverter` 2.1; React 19, three 0.186, MapLibre GL 6, `potree-core`, `proj4`.

**Spec:** `docs/superpowers/specs/2026-11-16-arquivos-3d-grandes-design.md` — leia antes de começar.

## Global Constraints

- Código simples: funções pequenas, uma responsabilidade cada, nenhuma abstração que este plano não peça. Comentários em português, só para o porquê (padrão do projeto).
- Nenhuma dependência além das listadas nas tarefas.
- pnpm. Frontend na porta 3333, servidor na 3334.
- Servidor roda em Windows hoje e em Linux depois: caminhos sempre com `node:path`, binário do conversor só por variável de ambiente.
- TypeScript do servidor e dos testes roda direto no Node 24: só sintaxe apagável (sem `enum`, sem parameter properties) e imports relativos com extensão `.ts`.
- Versões fixas no servidor, iguais às do frontend: `@thatopen/fragments` 3.4.7, `web-ifc` 0.0.78, `three` 0.186.1.
- Limites: arquivo até `3 * 1024**3` bytes; pedaço de `16 * 1024**2` bytes; 3 pedaços em paralelo; consulta do job a cada 2 s; pasta do job apagada após 24 h; GLB comprimido até `1024**3` bytes; teto de 2 000 000 de pontos no mapa.
- O navegador nunca lê o arquivo inteiro: sempre `File.slice`.
- Não quebrar: importação de `.frag`, troca globo/Mercator, modelo `hfc-fachada` já calibrado.
- Só dois testes automáticos (decisão do Henrique): Tarefa 1 e Tarefa 5. O resto é verificação manual.
- Arquivos reais de teste: `C:\Users\henrique.santos\Downloads\modelos`.

## Review Focus

Falhas que nenhum teste automático cobre. Por decisão do Henrique (pouco teste), cada uma é conferida à mão na Tarefa 6, não com teste novo.

1. Rede cai no meio do envio: o pedaço é refeito até 3 vezes; depois a linha mostra erro, e o mapa segue normal.
2. Cancelar durante a conversão: o processo ou a thread morre, a pasta some, o próximo da fila começa.
3. Servidor desligado: importar `.ifc`/`.glb`/`.las` mostra erro na linha; `.frag` e o mapa seguem funcionando.
4. Arquivo renomeado (extensão certa, conteúdo errado): erro claro, sem iniciar conversão.
5. Dois arquivos grandes seguidos: o segundo fica "Na fila…" e converte depois.

## Estrutura de arquivos

```
server/
  package.json, tsconfig.json, .env.example
  src/
    index.ts              lê a configuração, sobe o servidor, agenda a limpeza
    config.ts             Config e leitura das variáveis de ambiente
    app.ts                buildApp(config): monta o Fastify (usado também no teste)
    jobs/
      types.ts            JobState, JobStatus, JobResult, ModelFormat
      jobStore.ts         jobs em memória + pasta de cada job
      jobRoutes.ts        as seis rotas de /api/jobs
      magicBytes.ts       confere a assinatura do arquivo
      queue.ts            fila de uma conversão por vez
      cleanup.ts          apaga pastas com mais de 24 h
    converters/
      index.ts            extensão → conversor
      pointcloud.ts       chama o PotreeConverter
      ifc.ts              sobe a thread do IFC e repassa progresso
      ifcWorker.ts        roda o IfcImporter dentro da thread
      glb.ts              gltf-transform
  scripts/convert-local.ts  converte um arquivo local, sem upload (verificação)
  tests/files.test.ts
tests/crs.test.ts
src/features/conversion/
  api.ts                  chamadas a /api/jobs
  uploadFile.ts           fatia o File e envia 3 pedaços em paralelo
  useConversionJobs.ts    estado de cada envio/conversão, por item
src/features/models3d/
  loaders/types.ts        LoadedModel, Loader
  loaders/loadFrag.ts     (código que hoje está no Model3dLayer)
  loaders/loadGlb.ts
  loaders/loadPointCloud.ts
  loaders/index.ts        LOADERS por formato
  createThreeLayer.ts     (renomeado de createFragmentsLayer.ts)
  lodCamera.ts            câmera real para o nível de detalhe
  recenter.ts             traz objeto distante para a origem
  crs.ts                  EPSG → proj4, projetado → lng/lat, norte da grade
  lasHeader.ts            lê CRS e caixa do cabeçalho LAS
```

## Pré-requisito (Henrique)

- [ ] Baixar o `PotreeConverter` 2.1.x para Windows em https://github.com/potree/PotreeConverter/releases, extrair, e informar o caminho do `.exe`. O agente grava esse caminho em `server/.env.local` como `POTREE_CONVERTER_PATH=...`. O agente não baixa binário sozinho.

## Preparação

- [ ] Criar a branch `feat/arquivos-3d` a partir de `refactor-camadas`. O `vite.config.ts` tem uma mudança não commitada do Henrique (portas 3333): ela entra no commit da Tarefa 3, que mexe no mesmo arquivo.

---

### Task 1: Servidor — jobs, upload em pedaços, arquivos com Range

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/.env.example`, `server/src/{index,config,app}.ts`, `server/src/jobs/{types,jobStore,jobRoutes,magicBytes,cleanup}.ts`
- Test: `server/tests/files.test.ts`
- Modify: `package.json` (scripts `dev:server`: `pnpm --dir server dev`; `test`: `node --test tests/ && pnpm --dir server test`)

Dependências de `server/`: `fastify`, `@fastify/static`; dev: `typescript`, `@types/node`.
Scripts de `server/`: `dev`: `node --watch --env-file-if-exists=.env.local src/index.ts`; `start`: o mesmo sem `--watch`; `test`: `node --test tests/`.

**Interfaces — Produces:**

```ts
// jobs/types.ts
export type JobState = "uploading" | "queued" | "converting" | "done" | "error";
export type ModelFormat = "pointcloud" | "frag" | "glb";
export interface JobResult { format: ModelFormat; url: string }
export interface JobStatus { state: JobState; progress: number | null; message?: string; result?: JobResult }

// config.ts
export interface Config { port: number; tmpRoot: string; potreeConverterPath: string | undefined; distDir: string }
export function readConfig(env: NodeJS.ProcessEnv): Config   // PORT=3334, TMP_ROOT=os.tmpdir()/openmapsandbox-jobs

// app.ts
export function buildApp(config: Config): FastifyInstance

// jobs/jobStore.ts — um Map em memória; a pasta do job é <tmpRoot>/<jobId>/ com input.<ext> e out/
export interface Job { id: string; ext: string; size: number; received: Set<number>; status: JobStatus; dir: string; inputPath: string; outDir: string }
export function createJobStore(tmpRoot: string): {
  create(name: string, size: number): Promise<Job>;   // cria pasta, out/ e input vazio
  get(id: string): Job | undefined;
  remove(id: string): Promise<void>;                  // apaga a pasta
}
```

Rotas (seção 7.2 do design), com estas regras:

- `POST /api/jobs` `{ name, size }`: extensão em `.las .laz .ifc .glb` e `0 < size <= 3 GB`, senão 400. Responde `{ jobId, chunkSize }`. `jobId` = `crypto.randomUUID()`.
- `PUT /api/jobs/:id/chunks/:index`: corpo `application/octet-stream` tratado como stream e gravado em `input.<ext>` no offset `index * chunkSize`. 400 se o índice passa do último pedaço ou se o corpo passa do tamanho esperado daquele pedaço. Marca o índice em `received`. Repetir o mesmo índice é permitido.
- `POST /api/jobs/:id/convert`: 409 se falta pedaço; 400 com mensagem `"O arquivo não é um <EXT> válido."` se os bytes mágicos não batem (`LASF`, `glTF`, `ISO-10303-21`). Nesta tarefa só muda o estado para `queued`.
- `GET /api/jobs/:id`: devolve `JobStatus`; 404 se não existe.
- `DELETE /api/jobs/:id`: remove; 204.
- `GET /api/jobs/:id/files/*`: `reply.sendFile(caminho, job.outDir)` do `@fastify/static` (cuida de Range e de caminho fora da pasta). 404 se o job não existe.

`cleanup.ts`: `removeOldJobDirs(tmpRoot: string, maxAgeMs: number): Promise<void>`, chamado em `index.ts` na partida e a cada hora.

- [ ] **Step 1: Escrever o teste**

```ts
// server/tests/files.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "../src/app.ts";

test("/files não sai da pasta out/ do job", async () => {
  const tmpRoot = await mkdtemp(join(tmpdir(), "jobs-"));
  const app = buildApp({ port: 0, tmpRoot, potreeConverterPath: undefined, distDir: join(tmpRoot, "sem-dist") });
  const created = await app.inject({ method: "POST", url: "/api/jobs", payload: { name: "a.glb", size: 4 } });
  const { jobId } = created.json();
  await writeFile(join(tmpRoot, jobId, "out", "ok.txt"), "ok");
  await writeFile(join(tmpRoot, jobId, "segredo.txt"), "fora de out/");

  assert.equal((await app.inject(`/api/jobs/${jobId}/files/ok.txt`)).statusCode, 200);
  for (const path of ["../segredo.txt", "..%2Fsegredo.txt", "%2e%2e/segredo.txt", "..%5Csegredo.txt"]) {
    assert.notEqual((await app.inject(`/api/jobs/${jobId}/files/${path}`)).statusCode, 200, path);
  }
  assert.equal((await app.inject("/api/jobs/nao-existe/files/ok.txt")).statusCode, 404);
});
```

- [ ] **Step 2:** `pnpm --dir server install` e `pnpm --dir server test`. Esperado: FALHA (não existe `app.ts`).
- [ ] **Step 3:** Implementar os arquivos da lista com as interfaces acima.
- [ ] **Step 4:** `pnpm --dir server test`. Esperado: PASSA.
- [ ] **Step 5:** Commit: `feat(server): jobs, upload em pedaços e arquivos com Range`.

---

### Task 2: Servidor — fila e conversores

**Files:**
- Create: `server/src/jobs/queue.ts`, `server/src/converters/{index,pointcloud,ifc,ifcWorker,glb}.ts`, `server/scripts/convert-local.ts`
- Modify: `server/src/jobs/jobRoutes.ts` (`convert` enfileira; `DELETE` cancela), `server/src/app.ts`, `server/package.json`

Dependências novas de `server/`: `@thatopen/fragments@3.4.7`, `web-ifc@0.0.78`, `three@0.186.1`, `@gltf-transform/core`, `@gltf-transform/extensions`, `@gltf-transform/functions`, `meshoptimizer`, `sharp`.

**Interfaces — Consumes:** `Job`, `JobStatus`, `Config` da Tarefa 1.

**Interfaces — Produces:**

```ts
// converters/index.ts
export type Converter = (
  inputPath: string, outDir: string,
  onProgress: (progress: number | null) => void,   // 0 a 1, ou null se desconhecido
  signal: AbortSignal,
) => Promise<{ format: ModelFormat; file: string }>;   // file = nome do arquivo principal dentro de outDir
export function converterFor(ext: string, config: Config): Converter

// jobs/queue.ts — uma conversão por vez, em ordem de chegada
export function createQueue(convert: (job: Job, signal: AbortSignal) => Promise<void>): {
  enqueue(job: Job): void;
  cancel(jobId: string): void;   // tira da fila ou aborta a conversão em andamento
}
```

Regras:

- Quando um job sai da fila: estado `converting`; ao terminar, apaga `input.<ext>`, estado `done` com `result.url = /api/jobs/<id>/files/<file>`; se o conversor lança, estado `error` com `message` do erro.
- `pointcloud.ts`: `spawn(config.potreeConverterPath, [inputPath, "-o", outDir])`. `file = "metadata.json"`. Lê porcentagens do stdout se houver; senão `onProgress(null)`. `signal` abortado mata o processo. Sem caminho configurado: erro `"PotreeConverter não encontrado. Defina POTREE_CONVERTER_PATH."`.
- `ifc.ts` + `ifcWorker.ts`: `worker_threads`. A thread roda `new IfcImporter()` com `wasm = { path: <pasta do pacote web-ifc, com barra final>, absolute: true }` e `process({ readFromCallback: true, readCallback, progressCallback })`, lendo `inputPath` com `readSync` em pedaços (exemplo no JSDoc de `ProcessData`, em `@thatopen/fragments/dist/index.d.ts`). Grava `model.frag`. A thread manda o progresso por mensagem; `signal` abortado chama `worker.terminate()`. Falha: erro `"Não foi possível converter o IFC. Arquivos muito grandes passam do limite de memória do conversor (4 GB)."`.
- `glb.ts`: `NodeIO` com `ALL_EXTENSIONS` e o codificador/decodificador do `meshoptimizer`; `dedup()`, `prune()`, `textureCompress({ encoder: sharp, resize: [2048, 2048] })`, `meshopt({ encoder: MeshoptEncoder })`. Grava `model.glb`. Se o resultado passa de 1 GB: erro `"O GLB continua acima de 1 GB depois de comprimido e não cabe no navegador."`. `onProgress(null)`.
- `scripts/convert-local.ts <arquivo> <pastaDeSaida>`: chama `converterFor` direto e imprime progresso e resultado.

- [ ] **Step 1:** Implementar fila, conversores e script.
- [ ] **Step 2 — verificação com arquivo real:** rodar `node --env-file-if-exists=.env.local scripts/convert-local.ts` em `server/` para: `BASE_AP0_5cm_1.las`, os dois `.ifc` grandes e um `.glb`. Esperado: `metadata.json` + `hierarchy.bin` + `octree.bin`; `model.frag`; `model.glb`. Anotar o tempo de cada um.
- [ ] **Step 3 — PORTÃO A:** se o `PotreeConverter` recusar o LAS 1.4 formato 8, ou se o `IfcImporter` falhar em algum dos dois IFC, PARAR e relatar ao Henrique com a mensagem de erro. Não contornar por conta própria.
- [ ] **Step 4:** `pnpm --dir server test`. Esperado: PASSA.
- [ ] **Step 5:** Commit: `feat(server): fila e conversores de nuvem, IFC e GLB`.

---

### Task 3: Frontend — envio, acompanhamento e linha do item

**Files:**
- Create: `src/features/conversion/{api,uploadFile,useConversionJobs}.ts`
- Modify: `vite.config.ts` (proxy `/api` → `http://localhost:3334`), `src/features/models3d/models.ts`, `src/features/layers/{folderKinds.ts,readLayerFile.ts,useLayerFolders.ts,LayerRow.tsx,FolderSection.tsx,LayersPanel.tsx}`, `src/features/map/MapView.tsx`

**Interfaces — Consumes:** rotas e `JobStatus`/`JobResult` das Tarefas 1 e 2 (redeclarar os dois tipos em `conversion/api.ts`; frontend e servidor não compartilham código).

**Interfaces — Produces:**

```ts
// models3d/models.ts
export type ModelFormat = "frag" | "pointcloud" | "glb";
export interface Model3dConfig {
  /* campos atuais */
  format?: ModelFormat;                      // ausente = "frag"
  url?: string;                              // ausente enquanto envia/converte
  localOrigin?: [number, number, number];    // ponto do arquivo que vira a origem local (Tarefa 5)
}
export type LoadableModel = Model3dConfig & { url: string };
export type ModelStatus = "uploading" | "queued" | "converting" | "loading" | "ready" | "error";
export interface ModelActivity { status: ModelStatus; text?: string }

// conversion/api.ts
export function createJob(name: string, size: number): Promise<{ jobId: string; chunkSize: number }>
export function putChunk(jobId: string, index: number, chunk: Blob, signal: AbortSignal): Promise<void>
export function startConvert(jobId: string): Promise<void>
export function getJob(jobId: string): Promise<JobStatus>
export function deleteJob(jobId: string): Promise<void>
// Resposta não-ok vira Error com a mensagem do servidor; falha de rede vira
// Error("Servidor de conversão indisponível.")

// conversion/uploadFile.ts — 3 pedaços em paralelo, até 3 tentativas por pedaço
export function uploadFile(file: File, jobId: string, chunkSize: number,
  onProgress: (bytesSent: number) => void, signal: AbortSignal): Promise<void>

// conversion/useConversionJobs.ts
export function useConversionJobs(onDone: (itemId: string, result: JobResult) => void): {
  activity: Record<string, ModelActivity>;   // só itens enviando, na fila, convertendo ou com erro
  start(itemId: string, file: File): void;
  discard(itemId: string): void;             // aborta o envio, chama deleteJob, esquece o item
}

// layers/useLayerFolders.ts — passa a expor também:
//   activity (vinda do useConversionJobs, criado aqui dentro)
//   removeItem(id: string): void   // tira o item da pasta e chama discard(id)
```

Comportamento:

- `folderKinds.ts`: `models.accept = ".frag,.ifc,.glb,.las,.laz"`.
- `readLayerFile.ts`, leitor `models`: `.frag` como hoje, com `format: "frag"`. Outras extensões: item `{ id, name, format }` sem `url` (`.ifc` → `"frag"`, `.glb` → `"glb"`, `.las`/`.laz` → `"pointcloud"`).
- `useLayerFolders.importFile`: depois de somar os itens, chama `start(item.id, file)` para cada item sem `url`. `onDone` grava `url` e `format` no item.
- GET 404 durante a consulta (servidor reiniciou): erro `"O servidor reiniciou e o envio se perdeu. Importe de novo."`.
- `MapView`: o mapa recebe só modelos com `url`. O painel recebe `modelActivity` = `activity` do envio, e na falta dela o `modelStatus` atual.
- Texto da linha (`LayerRow` recebe `status` e `statusText`, primitivos, por causa do `memo`):
  - `uploading`: `Enviando 42% · 18 MB/s · faltam 1 min`
  - `queued`: `Na fila…`
  - `converting`: `Convertendo 37%`, ou `Convertendo…` sem progresso
  - `loading`: `Carregando…` (já existe)
  - `error`: a mensagem recebida, ou `Erro ao carregar`
- Botão novo na linha de modelo: ícone `X`, título "Cancelar", enquanto `uploading`/`queued`/`converting`; ícone `Trash2`, título "Remover", nos outros estados. Os dois chamam `removeItem(id)`. Linhas de pontos e trechos não mudam.

- [ ] **Step 1:** Implementar.
- [ ] **Step 2 — verificação:** `pnpm dev:server` e `pnpm dev`. Importar um `.glb` pequeno: a linha passa por Enviando → Convertendo → some do estado de envio; `GET /api/jobs/<id>` responde `done`. Importar `BASE_AP0_5cm_1.las`: porcentagem, velocidade e tempo restante andam; "Cancelar" remove a linha e a pasta do job some. (O objeto ainda não aparece no mapa: é a Tarefa 4.)
- [ ] **Step 3:** `pnpm build` e `pnpm lint`. Esperado: sem erro.
- [ ] **Step 4:** Commit: `feat(models3d): envio em pedaços e estado da conversão no painel`.

---

### Task 4: Frontend — camada genérica e carregadores por formato

**Files:**
- Create: `src/features/models3d/loaders/{types,loadFrag,loadGlb,loadPointCloud,index}.ts`, `src/features/models3d/{lodCamera,recenter}.ts`
- Rename: `createFragmentsLayer.ts` → `createThreeLayer.ts`
- Modify: `src/features/models3d/{Model3dLayer.tsx,georef.ts}`, `package.json` (dependência `potree-core`)

**Interfaces — Consumes:** `LoadableModel`, `ModelFormat` da Tarefa 3.

**Interfaces — Produces:**

```ts
// loaders/types.ts
export interface LoadedModel {
  object: Object3D;                                       // em metros, Y para cima, −Z = norte
  site?: { lng: number; lat: number } | null;            // só o .frag preenche (IfcSite)
  update?(lodCamera: PerspectiveCamera, renderer: WebGLRenderer): void;   // chamado a cada quadro
  dispose(): void | Promise<void>;
}
export type Loader = (config: LoadableModel, signal: AbortSignal) => Promise<LoadedModel>;

// loaders/index.ts
export const LOADERS: Record<ModelFormat, Loader>

// createThreeLayer.ts
export function createThreeLayer(id: string, loaded: LoadedModel, matrices: ModelMatrices): CustomLayerInterface

// lodCamera.ts
export function updateLodCamera(lodCamera: PerspectiveCamera, mvp: Matrix4, fovDeg: number, aspect: number): void

// recenter.ts — só age se o centro da caixa está a mais de 10 km da origem
export function recenterIfFar(object: Object3D): void

// georef.ts — terceiro parâmetro novo: usado quando não há config.position nem site
export function resolveAnchor(config: Model3dConfig, site: { lng: number; lat: number } | null,
  fallback: { lng: number; lat: number }): Anchor
```

Comportamento:

- `loadFrag`: o que o efeito de carga do `Model3dLayer` faz hoje (fetch, `engine.load`, `readIfcSiteLocation`, `hideIfcTerrain`), mais `recenterIfFar`. `update` chama `getFragmentsEngine().update()`.
- `loadGlb`: `GLTFLoader` + `MeshoptDecoder` de `three/examples/jsm`. `recenterIfFar`. `dispose` libera geometrias, materiais e texturas.
- `loadPointCloud`: `potree-core`, a partir de `config.url` (`metadata.json`; os outros dois arquivos ficam na mesma pasta). Tamanho de ponto fixo, `pointBudget = 2_000_000`. A nuvem (Z para cima) entra num `Group` com `rotation.x = -Math.PI / 2`. Dentro do grupo, a nuvem é deslocada para que `config.localOrigin` fique na origem; sem `localOrigin`, usa o centro da caixa em X e Y e o Z mínimo. `update` chama `potree.updatePointClouds([nuvem], lodCamera, renderer)`.
- `createThreeLayer`: igual à camada atual, trocando `model.object` por `loaded.object`. A cada quadro: monta `mvp = mainMatrix × modelMatrix` (como hoje), desenha com a câmera atual, e chama `loaded.update?.(lodCamera, renderer)` com a câmera de nível de detalhe atualizada por `updateLodCamera(lodCamera, mvp, map.transform.fov, largura / altura)`.
- `Model3dLayer`: o efeito de carga passa a chamar `LOADERS[config.format ?? "frag"](config, signal)` e a guardar o `LoadedModel`. `resolveAnchor` recebe o centro atual do mapa como `fallback`. O resto do componente não muda.

Câmera de nível de detalhe (o cálculo não é óbvio):

```ts
// A câmera que desenha carrega a matriz inteira do mapa na projeção e fica na origem.
// Para escolher o nível de detalhe é preciso a posição real do olho, em metros do modelo.
export function updateLodCamera(lodCamera: PerspectiveCamera, mvp: Matrix4, fovDeg: number, aspect: number): void {
  const inverse = mvp.clone().invert();
  const eye = new Vector4(0, 0, 1, 0).applyMatrix4(inverse);   // o olho é o ponto que a projeção leva a w = 0
  const target = new Vector3(0, 0, 1).applyMatrix4(inverse);   // centro da tela, no plano distante
  lodCamera.position.set(eye.x / eye.w, eye.y / eye.w, eye.z / eye.w);
  lodCamera.up.copy(new Vector3(0, 1, 1).applyMatrix4(inverse).sub(target).normalize());
  lodCamera.lookAt(target);
  lodCamera.fov = fovDeg;
  lodCamera.aspect = aspect;
  lodCamera.updateProjectionMatrix();
  lodCamera.updateMatrixWorld();
}
```

Ajuste `near`/`far` da câmera de nível de detalhe para a distância entre olho e alvo.

- [ ] **Step 1:** Implementar.
- [ ] **Step 2 — verificação:** o modelo `hfc-fachada` liga e fica no mesmo lugar de antes. Um `.frag` local importa como antes. Um `.glb` e um `.ifc` importados aparecem no centro do mapa e respondem à calibração. `BASE_AP0_5cm_1.las` aparece no centro do mapa; aproximar aumenta o detalhe, afastar reduz. Tudo em globo e em Mercator.
- [ ] **Step 3 — PORTÃO B:** PARAR e pedir ao Henrique para medir os quadros por segundo navegando com a nuvem carregada (DevTools → Rendering → Frame Rendering Stats), em globo e em Mercator, no notebook de placa integrada. Critério: 30 fps. Se não passar, relatar os números e esperar decisão. Não escrever leitor próprio sem aprovação.
- [ ] **Step 4:** `pnpm build` e `pnpm lint`. Esperado: sem erro.
- [ ] **Step 5:** Commit: `feat(models3d): camada única com carregadores de frag, GLB e nuvem`.

---

### Task 5: Frontend — georreferência da nuvem

**Files:**
- Create: `src/features/models3d/{crs,lasHeader}.ts`
- Test: `tests/crs.test.ts`
- Modify: `src/features/layers/readLayerFile.ts`, `package.json` (dependência `proj4`)

**Interfaces — Consumes:** `Model3dConfig.position`, `.bearingDeg`, `.altitude`, `.localOrigin` (Tarefa 3).

**Interfaces — Produces:**

```ts
// crs.ts — só importa proj4 (o teste roda este arquivo direto no Node)
export function epsgToProj4(epsg: number): string | null
//   32601–32660 → UTM WGS84 norte, zona = epsg − 32600
//   32701–32760 → UTM WGS84 sul,   zona = epsg − 32700
//   31965–31976 → UTM SIRGAS 2000 norte, zona = epsg − 31954
//   31977–31985 → UTM SIRGAS 2000 sul,   zona = epsg − 31960
//   outro → null
export function projectedToLngLat(crs: string, x: number, y: number): { lng: number; lat: number }
// Rumo do norte da grade, em graus, horário a partir do norte verdadeiro.
// Projeta (x, y) e (x, y + 100) e mede o rumo entre os dois pontos.
export function gridNorthBearing(crs: string, x: number, y: number): number

// lasHeader.ts
export interface LasGeoref {
  localOrigin: [number, number, number];             // centro em X e Y, Z mínimo, do cabeçalho
  position?: { lng: number; lat: number };           // ausente se o CRS não foi reconhecido
  bearingDeg?: number;
  unknownEpsg?: number;
}
export function readLasGeoref(file: File): Promise<LasGeoref>
```

`readLasGeoref`: lê `file.slice(0, offsetToPointData)`. Caixa nos offsets 179–226 do cabeçalho. CRS: VLR `34735`, chave `3072` (código EPSG) → `epsgToProj4`; se não houver ou não for reconhecido, VLR `2112` (WKT) passado direto ao `proj4`. Referência da leitura das VLRs: `GeoLibre/packages/map/src/cesium-point-cloud.ts` linhas 533–584 (MIT). Um `.laz` tem o mesmo cabeçalho.

`readLayerFile.ts`: para `.las`/`.laz`, chama `readLasGeoref` e copia `localOrigin`, `position`, `bearingDeg` para o item, com `altitude: 0` (base no chão; o mapa não tem relevo). Com `unknownEpsg`: `alert("CRS EPSG:<código> não reconhecido. O modelo foi colocado no centro do mapa; ajuste na calibração.")`.

- [ ] **Step 1: Escrever o teste**

```ts
// tests/crs.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { epsgToProj4, gridNorthBearing, projectedToLngLat } from "../src/features/models3d/crs.ts";

const near = (actual: number, expected: number, tolerance: number) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} longe de ${expected}`);

test("meridiano central no equador", () => {
  const wgs = projectedToLngLat(epsgToProj4(32722)!, 500000, 10000000);   // UTM 22S
  near(wgs.lng, -51, 1e-6); near(wgs.lat, 0, 1e-6);
  const sirgas = projectedToLngLat(epsgToProj4(31983)!, 500000, 10000000); // SIRGAS 2000 / UTM 23S
  near(sirgas.lng, -45, 1e-6); near(sirgas.lat, 0, 1e-6);
});

test("centro da nuvem real BASE_AP0_5cm_1.las", () => {
  const { lng, lat } = projectedToLngLat(epsgToProj4(32722)!, 752592.66, 7260597.4);
  near(lng, -48.5, 0.1); near(lat, -24.75, 0.05);
});

test("norte da grade", () => {
  const crs = epsgToProj4(32722)!;
  near(gridNorthBearing(crs, 500000, 7260597.4), 0, 1e-6);      // no meridiano central não há desvio
  near(gridNorthBearing(crs, 752592.66, 7260597.4), -1.05, 0.15); // a leste, no hemisfério sul: grade a oeste do norte
});

test("EPSG fora da lista", () => assert.equal(epsgToProj4(4326), null));
```

- [ ] **Step 2:** `node --test tests/`. Esperado: FALHA (não existe `crs.ts`).
- [ ] **Step 3:** Implementar `crs.ts`, `lasHeader.ts` e a mudança em `readLayerFile.ts`.
- [ ] **Step 4:** `node --test tests/`. Esperado: PASSA.
- [ ] **Step 5 — verificação:** importar `BASE_AP0_5cm_1.las`. O mapa voa para perto de lng −48,5 / lat −24,75 e a nuvem fica assentada no chão, alinhada com ruas e construções do mapa base.
- [ ] **Step 6:** `pnpm build` e `pnpm lint`. Commit: `feat(models3d): posição automática da nuvem pelo CRS do LAS`.

---

### Task 6: Modo de produção, verificação final e mapa de pastas

**Files:**
- Modify: `server/src/app.ts`, `package.json` (script `start`: `pnpm build && pnpm --dir server start`)

- [ ] **Step 1:** Em `buildApp`, se `config.distDir` existe, servir essa pasta na raiz com `@fastify/static` (segundo registro, `decorateReply: false`). `readConfig` usa `../dist` como padrão.
- [ ] **Step 2 — verificação:** `pnpm start`, abrir `http://localhost:3334`: o mapa abre e a importação funciona sem o Vite.
- [ ] **Step 3 — verificação manual dos cinco pontos do Review Focus**, um por um, anotando o resultado de cada.
- [ ] **Step 4 — verificação dos três formatos reais**, em globo e em Mercator: `BASE_AP0_5cm_1.las`, `HOTEL_FAIRMONT (1).ifc` (deve abrir na posição do `IfcSite`), `081-26-SONDOTÉCNICA_R08-IFC4X3.ifc` (centro do mapa), um `.glb`. Ocultar e mostrar cada um: recarrega da mesma URL, sem converter de novo.
- [ ] **Step 5:** `pnpm test`, `pnpm build`, `pnpm lint`. Esperado: tudo passa.
- [ ] **Step 6:** Commit: `feat(server): servir o frontend compilado`.
- [ ] **Step 7 — relatório final para o Henrique:** mapa de pastas (cada pasta e arquivo criado ou alterado, o que faz e por que existe), o porquê das escolhas principais, tempos de conversão medidos, resultado dos dois portões e dos cinco pontos do Review Focus, e o que não foi verificado.

## Fora desta entrega

Popup 3D (entrega 2), cortes e medição (entrega 3), e tudo o que a seção 2 do design lista como não-objetivo.
