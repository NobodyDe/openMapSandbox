# Projetos, camadas e elementos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Decisão do Henrique: um único agente Opus aplica o código seguindo a skill `simple-solid-code`. Sem revisor por tarefa.

**Goal:** Trocar as pastas de tipo fixo por projetos (nome, data, local) com camadas de qualquer formato, marcador no mapa, toda leitura de arquivo no servidor e fila BullMQ.

**Architecture:** O servidor converte todo arquivo (menos `.frag`) numa fila BullMQ + Redis e devolve, junto com o arquivo, o centro da camada. O frontend guarda projetos → camadas → elementos num hook só e entrega ao mapa as mesmas três listas planas de hoje (pontos, trechos, modelos), então as camadas de desenho não mudam.

**Tech Stack:** Node 24, Fastify, BullMQ, Redis 7 (Docker), React 19, react-map-gl/MapLibre, Tailwind v4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-17-projetos-camadas-design.md` — leia antes de começar. Ele manda em qualquer dúvida.

## Global Constraints

- Código simples: funções pequenas, uma responsabilidade, nenhuma abstração que o plano não peça. Comentários em português, só o porquê. Estilo dos arquivos existentes.
- Branch `feat/arquivos-3d`. Um commit por tarefa, mensagem dada na tarefa, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sem push.
- Servidor: TypeScript rodado direto pelo Node 24 (só sintaxe apagável, imports com `.ts`). Caminhos com `node:path`. Nada específico de Windows.
- Testes automáticos só os dois que já existem (`files.test.ts` e o de CRS). O resto é verificação manual.
- Limites: `.las`/`.laz` 4 GB, `.ifc`/`.glb` 3 GB, `.kmz` 1 GB. Pedaço de 16 MB. Jobs e pastas somem em 24 h.
- Visual (seção 7 do spec): neutros `slate`, cantos `rounded-[2px]`, linhas finas, sem sombra no painel, IBM Plex Sans 400/500 com `tabular-nums`. Sem âmbar e sem azul de destaque.
- Arquivos reais de teste: `C:\Users\henrique.santos\Downloads\modelos`.

## Review Focus

Verificados à mão na Tarefa 6 (pouco teste, decisão do Henrique):

1. Redis desligado: servidor sobe; importar mostra "Fila de conversão indisponível. Verifique o Redis." na linha da camada; `.frag` e o mapa seguem funcionando.
2. Servidor reiniciado no meio de uma conversão: a linha volta para "Na fila" e a conversão termina sozinha.
3. Projeto criado sem local com só um GLB: sem marcador, linha "Sem local"; importar depois a nuvem dá local ao projeto.
4. Excluir um projeto com camada convertendo: conversão cancelada, pasta do job apagada.
5. KMZ só com linhas, e KMZ sem nenhuma feição: camada aparece com "0 pt · N ln" ou "0 pt · 0 ln", sem erro.

## Estrutura de arquivos

```
docker-compose.yml                       Redis 7 para o servidor
server/src/
  config.ts                              + redisUrl
  app.ts                                 monta rotas + fila; fecha a fila no onClose
  jobs/
    types.ts                             JobResult novo (format, url, center, placement, warning)
    jobPaths.ts                          caminhos de um job a partir do id (novo)
    jobStore.ts                          só a fase de envio (memória)
    conversionQueue.ts                   BullMQ: add, status, cancel, close (novo; substitui queue.ts)
    jobRoutes.ts                         rotas lendo memória (envio) ou BullMQ (depois)
    magicBytes.ts                        + .kmz
  converters/
    index.ts                             Converter devolve ConversionOutput
    pointcloud.ts                        + placement/center pelo cabeçalho LAS
    ifc.ts                               + center pelo IfcSite
    glb.ts                               center null
    kmz.ts + kmzWorker.ts                KMZ → layer.geojson numa thread (novo)
  georef/
    crs.ts, lasHeader.ts                 movidos do frontend, lendo do disco
    ifcSite.ts                           lê RefLatitude/RefLongitude do texto do IFC (novo)
    kml.ts                               regras de pontos/linhas/atributos movidas do frontend (novo)
  tests/crs.test.ts                      movido de tests/
src/features/projects/                   substitui src/features/layers/
  types.ts                               Project, Layer, LngLat, ProjectInput
  elements.ts                            elementIds, mapItems, geojsonToElements
  useProjects.ts                         estado + importação + localização automática
  ProjectsPanel.tsx, ProjectSection.tsx, LayerRow.tsx, ElementRow.tsx, ProjectForm.tsx
  ProjectMarker.tsx                      marcador DOM no mapa
  VisibilityButton.tsx, FileImportButton.tsx   movidos de layers/
```

Saem: `src/features/layers/` inteiro, `src/lib/{kmz.ts,kmlAttributes.ts}`, `src/features/points/kmzToPoints.ts`, `src/features/trechos/{kmzToTrechos.ts,kmzTrechos.worker.ts,importTrechosKmz.ts}`, `src/features/models3d/{crs.ts,lasHeader.ts}`, `server/src/jobs/queue.ts`, `tests/`. Dependências do front que saem: `jszip`, `@tmcw/togeojson`, `@xmldom/xmldom`, `@turf/turf`, `proj4`.

---

### Task 0: Concluir a tarefa 6 da entrega 1

**Files:** `package.json`, `server/src/app.ts` (mudanças já na árvore, sem commit)

- [ ] **Step 1:** Ler o diff atual (`git diff`). Ele faz o servidor entregar `dist/` e cria o script `start` na raiz.
- [ ] **Step 2 — verificação:** `pnpm start` (porta 3334 livre antes), abrir `http://localhost:3334`: o mapa abre. Parar o servidor.
- [ ] **Step 3:** Commit: `feat(server): servir o frontend compilado`.

---

### Task 1: Servidor — fila BullMQ

**Files:**
- Create: `docker-compose.yml`, `server/src/jobs/jobPaths.ts`, `server/src/jobs/conversionQueue.ts`
- Modify: `server/src/config.ts`, `server/src/app.ts`, `server/src/jobs/{jobStore,jobRoutes,types}.ts`, `server/src/converters/index.ts`, `server/.env.example`, `server/tests/files.test.ts`, `server/package.json` (dependência `bullmq`)
- Delete: `server/src/jobs/queue.ts`

**Interfaces — Produces:**

```ts
// jobs/types.ts
export type ResultFormat = "geojson" | "frag" | "glb" | "pointcloud";
export interface LngLat { lng: number; lat: number }
export interface Placement { position: LngLat; bearingDeg: number; localOrigin: [number, number, number] }
export interface ConversionOutput {
  format: ResultFormat; file: string; center: LngLat | null; placement?: Placement; warning?: string;
}
export interface JobResult extends Omit<ConversionOutput, "file"> { url: string }
// JobState e JobStatus não mudam

// jobs/jobPaths.ts — único lugar que monta caminhos de job
export function isJobId(id: string): boolean   // UUID
export function jobPaths(tmpRoot: string, id: string): { dir: string; outDir: string; inputPath(ext: string): string }

// jobs/conversionQueue.ts — fila "conversions", worker no mesmo processo, concurrency 1
export interface ConversionQueue {
  add(jobId: string, ext: string): Promise<void>;          // jobId = UUID do envio; data = { ext }
  status(jobId: string): Promise<JobStatus | null>;        // null = BullMQ não conhece
  cancel(jobId: string): Promise<void>;                    // waiting: job.remove(); active: worker.cancelJob(id)
  close(): Promise<void>;
}
export function createConversionQueue(config: Config): ConversionQueue

// converters/index.ts
export type Converter = (inputPath: string, outDir: string,
  onProgress: (progress: number | null) => void, signal: AbortSignal) => Promise<ConversionOutput>;

// config.ts: Config ganha redisUrl (REDIS_URL, padrão "redis://localhost:6379")
```

Regras:

- `docker-compose.yml`: serviço `redis`, imagem `redis:7-alpine`, `command: redis-server --appendonly yes`, volume `redis-data:/data`, porta `"127.0.0.1:6379:6379"`.
- `add`: opções `{ jobId, attempts: 1, removeOnComplete: { age: 86400 }, removeOnFail: { age: 86400 } }`. Erro de conexão vira `Error("Fila de conversão indisponível. Verifique o Redis.")`.
- Processador `(job, _token, signal)`: roda o conversor com os caminhos de `jobPaths`; `onProgress` chama `job.updateProgress` só com número; ao terminar apaga o `input.<ext>` e devolve `JobResult` com `url = /api/jobs/<id>/files/<file>`.
- `status`: `waiting`/`delayed`/`prioritized` → `queued`; `active` → `converting` (progresso > 0 vira número, senão `null`); `completed` → `done` com `result = job.returnvalue`; `failed` → `error` com `message = job.failedReason`.
- Se `worker.cancelJob` não existir na versão instalada, use um `Map<string, AbortController>` local ao processador. Anote qual caminho usou.
- `jobStore`: guarda só jobs em envio (`uploading`); `convert` tira o job dele depois do `add`. Caminhos via `jobPaths`.
- Rotas: `GET /api/jobs/:id` → memória, senão `queue.status`, senão 404. `DELETE` → tira da memória e `queue.cancel`, depois apaga a pasta (via `jobPaths`, com `maxRetries: 5`). `/files/*` → valida `isJobId` e serve de `jobPaths(...).outDir`, sem consultar memória.
- `app.ts`: cria a fila, passa às rotas, `app.addHook("onClose", () => queue.close())`. O servidor sobe mesmo com Redis desligado.
- `files.test.ts`: o teste continua o mesmo, só ajustado à criação do app (precisa do Redis no ar; diga isso num comentário de uma linha no teste).

- [ ] **Step 1:** `docker compose up -d redis`. Esperado: Redis em 127.0.0.1:6379.
- [ ] **Step 2:** Implementar.
- [ ] **Step 3:** `pnpm --dir server test` e `npx tsc --noEmit -p server`. Esperado: passa.
- [ ] **Step 4 — verificação:** `pnpm dev:server`; enviar um `.glb` pelo app (o front ainda é o atual): converte e carrega. Reiniciar o servidor no meio da conversão da nuvem real: a linha volta a "Na fila…" e termina.
- [ ] **Step 5:** Commit: `feat(server): fila de conversão com BullMQ e Redis`.

---

### Task 2: Servidor — centro de cada camada e KMZ

**Files:**
- Create: `server/src/georef/{ifcSite,kml}.ts`, `server/src/converters/{kmz,kmzWorker}.ts`
- Move: `src/features/models3d/{crs,lasHeader}.ts` → `server/src/georef/`; `tests/crs.test.ts` → `server/tests/crs.test.ts`
- Modify: `server/src/converters/{index,pointcloud,ifc,glb}.ts`, `server/src/jobs/{magicBytes,jobRoutes}.ts`, `server/package.json`, `package.json` (script `test`: `pnpm --dir server test`)

Dependências novas do servidor: `jszip`, `@tmcw/togeojson`, `@xmldom/xmldom`, `@turf/turf`, `proj4`, `@types/geojson`.

**Interfaces — Consumes:** `ConversionOutput`, `Converter` (Tarefa 1).

**Interfaces — Produces:**

```ts
// georef/lasHeader.ts — mesma lógica de hoje, lendo do disco
export function readLasGeoref(path: string): Promise<LasGeoref>   // LasGeoref não muda
// georef/ifcSite.ts — lê o arquivo em pedaços até a linha IFCSITE(
export function readIfcSite(path: string): Promise<LngLat | null>
// georef/kml.ts — regras de hoje (kmzToPoints, kmzToTrechos, kmlAttributes), sem mudança de regra
export function kmlToFeatures(collection: FeatureCollection): Feature[]   // properties: kind, name, color, attributes, extensaoKm?
```

Regras:

- `pointcloud`: lê o cabeçalho antes de converter (o input é apagado no fim). `placement` = `{ position, bearingDeg, localOrigin }`; `center` = `position`. Com `unknownEpsg`: sem `placement`, `center: null`, `warning: "CRS EPSG:<código> não reconhecido. Ajuste a posição na calibração."`.
- `ifc`: `center` = `readIfcSite(inputPath)`. `RefLatitude`/`RefLongitude` são o 10º e 11º argumentos de `IFCSITE(...)`, listas `(g,m,s,micro)` ou `$`. Converter com a mesma regra do `compoundAngleToDegrees` do front (copiar a função).
- `glb`: `center: null`.
- `kmz` (`.kmz`, assinatura `PK`, limite 1 GB): `kmzWorker.ts` faz unzip → togeojson → `kmlToFeatures` → grava `layer.geojson`; `kmz.ts` sobe a thread como `ifc.ts` faz (progresso `null`, abort encerra a thread). `center` = centro do `bbox` de todas as feições, ou `null` sem feições. `format: "geojson"`, `file: "layer.geojson"`.

- [ ] **Step 1:** Mover `crs.test.ts` e ajustar o import. `pnpm --dir server test`. Esperado: FALHA (crs.ts ainda não está no servidor).
- [ ] **Step 2:** Implementar.
- [ ] **Step 3:** `pnpm test` e `npx tsc --noEmit -p server`. Esperado: passa.
- [ ] **Step 4 — verificação:** `node --env-file-if-exists=.env.local scripts/convert-local.ts` com a nuvem real, `HOTEL_FAIRMONT (1).ifc` e um KMZ (pedir ao Henrique um KMZ real se não houver um em `Downloads\modelos`). Conferir: nuvem com `center` perto de lng −48,50 / lat −24,75; hotel perto de lat −22,90 / lng −43,23; KMZ com `center` dentro da área das feições.
- [ ] **Step 5:** Commit: `feat(server): KMZ no servidor e centro de cada camada`.

---

### Task 3: Frontend — projetos no lugar das pastas (estado e mapa)

**Files:**
- Create: `src/features/projects/{types,elements,useProjects}.ts`
- Modify: `src/features/conversion/api.ts` (JobResult novo; mensagem do 404: `"Envio não encontrado no servidor. Importe de novo."`), `src/features/models3d/{models,Model3dLayer}.tsx/.ts`, `src/features/map/MapView.tsx`, `package.json` (tirar as 5 dependências)
- Delete: os arquivos de KMZ e CRS do front listados em "Saem"

**Interfaces — Consumes:** `JobResult` (Tarefa 1, redeclarado no front).

**Interfaces — Produces:**

```ts
// projects/types.ts
export interface LngLat { lng: number; lat: number }
export interface Project { id: string; name: string; date: string; location: LngLat | null; layers: Layer[] }
export type Layer =
  | { kind: "kmz"; id: string; name: string; points: MapPoint[]; trechos: Trecho[] }
  | { kind: "model"; id: string; name: string; model: Model3dConfig };   // model.id === layer.id
export interface ProjectInput { name: string; date: string; location: LngLat | null }

// projects/elements.ts
export function elementIds(layer: Layer): string[]      // kmz: ids dos pontos e trechos; model: [layer.id]
export function projectElementIds(project: Project): string[]
export function mapItems(projects: Project[]): { points: MapPoint[]; trechos: Trecho[]; models: Model3dConfig[] }
export function geojsonToElements(layerId: string, collection: FeatureCollection): { points: MapPoint[]; trechos: Trecho[] }
//   ids "<layerId>/<índice>", como hoje

// projects/useProjects.ts
export function useProjects(): {
  projects: Project[];
  hiddenIds: ReadonlySet<string>;            // elementos
  hiddenMarkers: ReadonlySet<string>;        // projetos
  activity: Record<string, ModelActivity>;   // por id de camada
  toggle(id: string): void;
  setHidden(ids: string[], hidden: boolean): void;
  toggleMarker(projectId: string): void;
  createProject(input: ProjectInput): string;          // devolve o id
  updateProject(id: string, input: ProjectInput): void;
  removeProject(id: string): void;                     // chama discard de cada camada
  importFiles(projectId: string, files: File[]): void;
  removeLayer(layerId: string): void;
  adoptLocation(projectId: string, center: LngLat): void;   // só se location === null
};
export type ProjectsState = ReturnType<typeof useProjects>;

// models3d/Model3dLayer.tsx — props novas
fallback: LngLat | null;                                     // local do projeto
onAnchorResolved: (id: string, anchor: Anchor, fromFile: boolean) => void;
// resolveAnchor(config, site, fallback ?? centro do mapa); fromFile = config.position ou site existem
```

Regras:

- Projeto inicial: `{ id: "hfc", name: "HFC — Fachada", date: "2026-11-16", location: { lng: -43.1895761, lat: -22.986445 } }` com uma camada `model` do `MODELS_3D[0]`, oculta no início (como hoje).
- `importFiles`: um arquivo = uma camada. `.frag` → camada `model` com `url` de `URL.createObjectURL`, sem servidor. Outros → camada sem resultado (`kmz` com listas vazias ou `model` com `format` e sem `url`) e `start(layer.id, file)`.
- Ao concluir (`onDone`): `geojson` → baixa `result.url`, `geojsonToElements`, preenche a camada. Outros → `model` recebe `url`, `format`, e se houver `placement`: `position`, `bearingDeg`, `localOrigin`, `altitude: 0`. Depois, `result.center` → `adoptLocation`. `result.warning` → vai para `activity` da camada como texto (status `ready`).
- O que entra aparece ligado (elementos fora de `hiddenIds`).
- `MapView`: troca `useLayerFolders` por `useProjects`; `mapItems` alimenta `PointsLayer`, `TrechosLayer` e `Model3dLayer` (com `useVisibleItems`, como hoje). `Model3dLayer` recebe `fallback` = local do projeto da camada. `onAnchorResolved` com `fromFile` → `adoptLocation`.
- O painel atual vai quebrar nesta tarefa; mantenha o `LayersPanel` fora do `MapView` (botão "Camadas" sem efeito) até a Tarefa 4.

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** `pnpm build` e `pnpm lint`. Esperado: sem erro.
- [ ] **Step 3 — verificação:** `pnpm dev`: o mapa abre sem erro no console, em globo e Mercator. A importação real é verificada na Tarefa 4, quando o painel existe.
- [ ] **Step 4:** Commit: `feat(projects): projetos, camadas e elementos no estado do mapa`.

---

### Task 4: Frontend — painel de projetos

**Files:**
- Create: `src/features/projects/{ProjectsPanel,ProjectSection,LayerRow,ElementRow,ProjectForm}.tsx`
- Move: `src/features/layers/{VisibilityButton,FileImportButton}.tsx` → `src/features/projects/` (`FileImportButton` passa a aceitar vários arquivos: `onFiles(files: File[])`, `multiple`)
- Delete: `src/features/layers/`
- Modify: `src/features/map/MapView.tsx`, `index.html` (IBM Plex Sans 400/500 do Google Fonts), `src/index.css` (fonte do app e `font-variant-numeric: tabular-nums` no painel)

**Interfaces — Consumes:** `ProjectsState`, `Project`, `Layer`, `elementIds`, `projectElementIds` (Tarefa 3); `searchPlace` (`src/features/search/searchPlace.ts`).

**Interfaces — Produces:**

```ts
// ProjectsPanel props
interface ProjectsPanelProps {
  projects: ProjectsState;
  focusProjectId: string | null;          // marcador clicado: expande e rola até ele
  onPickLocation(onPicked: (p: LngLat) => void): void;   // "Marcar no mapa"
  onFlyTo(project: Project): void;
  renderModelDetails(model: Model3dConfig): ReactNode;   // calibração, como hoje
  onClose(): void;
}
// MapView: estado pickLocation: ((p: LngLat) => void) | null — com ele, o próximo clique no
// mapa chama a função e limpa o estado; cursor "crosshair"; Esc cancela
```

Regras (copiar o visual do mockup; detalhes na seção 7 do spec):

- Cabeçalho "Projetos" com "N projetos · M camadas"; busca "Buscar projeto, camada ou elemento"; abas "Todos" e "Ligados N".
- Projetos ordenados por data, mais recente primeiro. Data exibida `dd/mm/aaaa`.
- Linha do projeto: seta, `Folder`, nome, data, botão do marcador (`MapPin`/`MapPinOff`, título "Mostrar no mapa"/"Esconder do mapa"), olho, `…` com "Editar", "Ir até o projeto" (só com local), "Excluir projeto" (com `confirm`). Sem local: "Sem local" no lugar da data.
- Linha da camada (fio `border-l` fino): ícone por tipo (`Route` KMZ, `Building` IFC/FRAG, `Grain`/`Sparkles` nuvem, `Box` GLB), nome, etiqueta de contorno com o formato, resumo (`120 pt · 8 ln` no KMZ), olho, `…` (detalhes do modelo e "Remover camada"). Em envio/conversão: texto da `activity` + linha de 1 px com o progresso + botão "Cancelar" (`X`) que chama `removeLayer`.
- Elementos (só KMZ, segundo fio): `Dot` ou `Spline`, nome, olho; clique abre `AttributesTable`, um por vez.
- Olho de projeto/camada: "ligado" se algum elemento abaixo está ligado; clique desliga todos; todos desligados → liga todos.
- Última linha de cada projeto: "Importar arquivo" com `.kmz,.frag,.ifc,.glb,.las,.laz`, vários arquivos.
- Rodapé: só "Novo projeto" (botão em tinta cheia). Abre `ProjectForm`: nome (obrigatório), data (`<input type="date">`, padrão hoje), local opcional mostrado como `lat, lng` com "Buscar lugar" (campo + `searchPlace`), "Marcar no mapa" e "Limpar". Mesmo formulário para "Editar".
- Busca: casa nome do projeto, da camada ou do elemento; filtrando, projetos e camadas abrem.

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** `pnpm build` e `pnpm lint`. Esperado: sem erro.
- [ ] **Step 3 — verificação no app (Redis e servidor no ar):** criar um projeto sem local; importar de uma vez um KMZ, `HOTEL_FAIRMONT (1).ifc` e um GLB; conferir etiquetas, resumo do KMZ, progresso e que o projeto ganha local quando a primeira conversão com centro termina. Criar outro projeto marcando o local no mapa. Editar, excluir.
- [ ] **Step 4:** Commit: `feat(projects): painel de projetos, camadas e elementos`.

---

### Task 5: Frontend — marcador do projeto no mapa

**Files:**
- Create: `src/features/projects/ProjectMarker.tsx`
- Modify: `src/features/map/MapView.tsx`

**Interfaces — Consumes:** `Project`, `hiddenMarkers`, `hiddenIds`, `elementIds` (Tarefa 3); `focusProjectId` do painel (Tarefa 4).

```ts
interface ProjectMarkerProps { project: Project; selected: boolean; onClick(): void }
// MapView: closeZoom (zoom >= 16), atualizado no onZoom só quando cruza o limite
```

Regras:

- `<Marker longitude latitude anchor="bottom">` do react-map-gl. Rótulo retangular (`Folder`, nome, nº de camadas), haste de 1 px, losango no ponto. `selected` = rótulo em tinta cheia (`selected` = projeto em `focusProjectId`).
- Mostra só se: tem `location`, não está em `hiddenMarkers`, e não (`closeZoom` e o projeto tem algum elemento de camada `model` ligado).
- Clique: abre o painel, `focusProjectId = project.id`, `flyTo({ center, zoom: 16 })`.
- "Ir até o projeto" do painel usa o mesmo voo.

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** `pnpm build` e `pnpm lint`.
- [ ] **Step 3 — verificação:** marcador do HFC aparece; ligar o modelo e aproximar até o zoom 16: some; desligar o modelo: volta; botão do marcador esconde/mostra; clique abre o painel no projeto. Globo e Mercator.
- [ ] **Step 4:** Commit: `feat(projects): marcador do projeto no mapa`.

---

### Task 6: Verificação final e mapa de pastas

- [ ] **Step 1:** Os cinco pontos do Review Focus, um por um, anotando o resultado.
- [ ] **Step 2:** `pnpm test`, `pnpm build`, `pnpm lint`. Esperado: passa.
- [ ] **Step 3:** Relatório: commits, resultado dos cinco pontos, o que não foi verificado, desvios do plano com motivo, e o mapa de pastas (cada arquivo criado, movido, alterado ou apagado, uma linha sobre o que faz e por que existe).

## Fora deste plano

Guardar projetos (storage), workers em outras máquinas, tiles vetoriais para KMZ, popup 3D, cortes e medição.
