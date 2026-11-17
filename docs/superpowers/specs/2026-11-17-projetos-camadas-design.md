# Projetos, camadas e elementos — design

Data: 2026-11-17
Status: aguardando aprovação
Depende de: `2026-11-16-arquivos-3d-grandes-design.md` (entrega 1 já implementada na branch `feat/arquivos-3d`)

## 1. Intenção

Hoje o painel tem "pastas" de tipo fixo (Trechos, Pontos, Modelos 3D). A pasta passa a ser
um **projeto**: todo o material de um local. Todo projeto tem nome, data e local, e aparece
no mapa como um marcador. Dentro dele ficam as **camadas** (um arquivo importado cada, de
qualquer formato), e dentro das camadas, os **elementos**.

Junto com isso, o servidor assume toda a leitura de arquivos, inclusive KMZ, para tirar
peso do navegador. A fila de conversão passa a usar BullMQ, uma arquitetura já validada,
no lugar do código próprio.

## 2. Objetivos, não-objetivos, anti-objetivos

### Objetivos

- Hierarquia projeto → camada → elemento, no painel e na visibilidade.
- Projeto com nome, data e local. Local opcional na criação.
- Um projeto aceita qualquer arquivo: `.kmz`, `.frag`, `.ifc`, `.glb`, `.las`, `.laz`.
- Marcador do projeto no mapa, com botão para escondê-lo.
- Todo arquivo (menos `.frag`) passa pelo servidor. O servidor devolve, além do arquivo
  convertido, o ponto central da camada.
- Fila de conversão em BullMQ + Redis: conversões sobrevivem a reinício do servidor.
- Visual maduro: linhas finas, cantos de 2 px, sem cor de destaque (mockup aprovado).

### Não-objetivos

- Guardar projetos. Eles continuam sumindo ao recarregar a página (storage é futuro).
- Workers em outras máquinas. Exige storage compartilhado (S3/MinIO), que é futuro.
- Tiles vetoriais (PMTiles) para KMZ.
- Login.

### Anti-objetivos

- Ler KMZ ou cabeçalho LAS no navegador.
- Marcador do projeto cobrindo o modelo de perto.
- Ícone do projeto mudando de lugar a cada importação.
- Perder uma conversão porque o servidor reiniciou.
- Quebrar o que a entrega 1 entregou (envio em pedaços, conversão, nuvem, calibração).

## 3. Restrições

- Código simples, seguindo a skill `simple-solid-code` (decisão do Henrique).
- Pouco teste: só onde um erro passa despercebido (decisão do Henrique, mantida).
- Servidor roda no Windows do Henrique hoje e numa VM Linux depois. Docker já está
  instalado nesta máquina.
- Antes desta reformulação, a tarefa 6 da entrega 1 (servidor entregar o frontend
  compilado), que ficou sem commit, é concluída. (decisão do Claude)

## 4. Abordagens consideradas

### Local do projeto

- **Escolhida (Henrique):** marcado ao criar, mas opcional. Sem ele, o projeto adota a
  posição da primeira camada que tiver uma e fica nela.
- Descartada: sempre calculado das camadas. O ícone andaria a cada importação, e um KMZ
  de rodovia de 300 km poria o ícone no meio do nada.

### Papel do servidor

- **A. Tudo pelo servidor — escolhida (Henrique).** KMZ entra na fila e sai como GeoJSON.
  Toda conversão devolve o ponto central da camada. Um caminho de importação só; o front
  perde `jszip`, `togeojson`, `xmldom`, `@turf/turf` e `proj4`.
- B. KMZ no navegador, servidor só para 3D. Menos mudança, mas dois caminhos e leitura
  de pontos na thread do mapa.
- C. KMZ em tiles vetoriais. Melhor para KMZ gigante, mas depende do `tippecanoe`, que
  não roda bem no Windows. Desproporcional hoje.

### Fila

- **BullMQ + Redis — escolhida (Henrique).** Biblioteca Node (MIT) com estado, progresso,
  cancelamento, persistência e detecção de job travado prontos.
- RabbitMQ: é um servidor de mensagens, não um sistema de jobs. Estado, progresso e
  status teriam de ser escritos por nós. Serve para muitos serviços em várias linguagens.
- Fila própria em memória (hoje): perde tudo ao reiniciar.

## 5. Modelo de dados (frontend)

```ts
interface Project {
  id: string;
  name: string;
  date: string;                          // AAAA-MM-DD
  location: { lng: number; lat: number } | null;
  layers: Layer[];
}

type Layer =
  | { kind: "kmz"; id: string; name: string; points: MapPoint[]; trechos: Trecho[] }
  | { kind: "model"; id: string; name: string; model: Model3dConfig };
```

- **Elementos** de uma camada KMZ: seus pontos e trechos (tipos `MapPoint` e `Trecho`
  atuais). Uma camada de modelo ou nuvem é um elemento só: o próprio modelo.
- Ids dos elementos são prefixados com o id da camada (`<layerId>/<índice>`), como hoje
  com a pasta, para não colidirem.
- **Visibilidade:** continua um único conjunto `hiddenIds` de ids de elementos. O olho da
  camada liga/desliga todos os elementos dela; o do projeto, todos os do projeto.
- **Marcador:** conjunto à parte `hiddenMarkers` de ids de projeto.
- O mapa continua recebendo três listas planas (pontos, trechos, modelos), montadas a
  partir dos projetos. `PointsLayer`, `TrechosLayer` e `Model3dLayer` não mudam.
- O projeto de exemplo é o "HFC — Fachada" (o modelo `hfc-fachada` atual), com o local
  dele (-43,1895761, -22,986445).

## 6. Local do projeto

- Formulário de novo projeto: nome (obrigatório), data (padrão: hoje), local (opcional).
- O local pode ser preenchido por "Buscar lugar" (usa o `searchPlace` que já existe) ou
  "Marcar no mapa" (o próximo clique no mapa define o local; Esc cancela).
- Projeto sem local adota o `center` da primeira camada que trouxer um (seção 8). Depois
  disso, só muda pela edição do projeto.
- Para um `.frag` local (não passa pelo servidor), o centro vem do `IfcSite` lido quando o
  modelo carrega. O centro do mapa usado como último recurso de posição de modelo nunca
  vira local do projeto.
- Projeto sem local não tem marcador; a linha dele mostra "Sem local".
- Camadas importadas depois nunca mudam o local de um projeto que já tem um.
- Posição de um modelo, em ordem: a do próprio arquivo (`IfcSite`, CRS do LAS) → o local
  do projeto → o centro do mapa. Um GLB, ou um IFC sem `IfcSite`, num projeto com local
  nasce no local do projeto. A calibração continua ajustando depois.

## 7. Painel e marcador

Mockup aprovado em 2026-11-17. Tokens:

- Cor: neutros do app (tinta `slate-900`, texto secundário `slate-500`, linhas
  `slate-200`/`slate-300`, fundo branco). Ação principal e marcador selecionado em tinta
  cheia. Vermelho só para erro. Sai o âmbar da pasta e o azul dos botões.
- Tipo: IBM Plex Sans (Google Fonts, no `index.html`), pesos 400 e 500, números tabulares.
  Vale para o app inteiro. (decisão do Claude)
- Forma: cantos de 2 px, linhas finas, sem sombra no painel.

Painel ("Projetos"):

- Busca por projeto, camada ou elemento. Abas "Todos" e "Ligados".
- Linha do projeto: seta, nome, data, botão do marcador (`MapPin`/`MapPinOff`), olho, `…`
  (editar, ir até o projeto, excluir).
- Linha da camada, ligada ao projeto por um fio vertical fino: ícone do tipo, nome,
  etiqueta de contorno com o formato (`KMZ`, `IFC`, `LAS`, `GLB`, `FRAG`), resumo
  (`120 pt · 8 ln` no KMZ), olho, `…` (calibração para modelos; remover camada).
- Conversão em andamento: texto curto ("Enviando 42%", "Na fila", "Convertendo 37%") e uma
  linha de progresso de 1 px sob a camada; botão de cancelar.
- Elementos do KMZ, com fio vertical: ícone de ponto ou linha, nome, olho. Clicar abre os
  atributos, como hoje. Todos os elementos são listados (as linhas já usam `memo`, e os
  KMZ atuais têm cerca de 1.400 itens). (decisão do Claude)
- Última linha de cada projeto: "Importar arquivo", aceitando as seis extensões.
- Rodapé: só "Novo projeto". O "Importar" do rodapé do mockup sai, porque obrigaria a
  perguntar o projeto de destino; a importação fica dentro de cada projeto. (decisão do
  Claude)

Marcador no mapa:

- Elemento DOM (`<Marker>` do react-map-gl): rótulo retangular com ícone de pasta, nome e
  número de camadas; haste fina; losango no ponto exato.
- Selecionado (projeto aberto no painel) = rótulo preenchido em tinta.
- Some a partir do zoom 16 quando o projeto tem algum modelo ou nuvem ligado: é ali que
  ele cobriria o modelo. Projeto só com KMZ mantém o marcador em qualquer zoom. Some
  também quando escondido pelo botão do marcador ou quando o projeto não tem local.
- O olho do projeto e o da camada mostram "ligado" se algum elemento abaixo está ligado;
  clicar desliga todos. Todos desligados: clicar liga todos (regra atual da pasta).
- "Importar arquivo" aceita vários arquivos de uma vez; cada um vira uma camada.
- "Remover camada" e "Excluir projeto" chamam `DELETE /api/jobs/:id` de cada camada que
  passou pelo servidor: cancela o que estiver em andamento e apaga os arquivos.
- Clicar: abre o painel com o projeto expandido e voa até o local, zoom 16.

## 8. Servidor

### 8.1 Fila com BullMQ

- `docker-compose.yml` na raiz com Redis 7 (`redis:7-alpine`, `--appendonly yes`, volume,
  porta só em `127.0.0.1:6379`). Variável `REDIS_URL`, padrão `redis://localhost:6379`.
- Uma fila `conversions`. API e worker no mesmo processo, `concurrency: 1`. Separar o
  worker depois é rodar o mesmo código com outro ponto de entrada.
- O id do job do BullMQ é o mesmo UUID do envio.
- A fase de envio (pedaços) continua em memória, como hoje. Ao chamar `convert`, o job
  entra no BullMQ com `data: { ext }` e sai da memória. Daí em diante, status, progresso
  e resultado vêm do BullMQ (`queue.getJob`, `job.getState()`, `job.progress`,
  `job.returnvalue`, `job.failedReason`). `GET /api/jobs/:id` procura primeiro na memória
  (envio), depois no BullMQ, e só então responde 404.
- Estados do BullMQ para o frontend: `waiting`/`delayed`/`prioritized` → `queued`,
  `active` → `converting`, `completed` → `done`, `failed` → `error`. Depois de um reinício,
  a linha da camada pode voltar de "Convertendo" para "Na fila"; o frontend só mostra o
  estado que recebe.
- `attempts: 1`. Conversão interrompida por queda do processo volta sozinha para a fila
  quando o servidor sobe de novo (job travado do BullMQ).
- `removeOnComplete` e `removeOnFail` com `age` de 24 h, alinhado com a limpeza de pastas.
- Progresso: o conversor chama `job.updateProgress`.
- Cancelar (`DELETE`): no envio, apaga da memória; na fila, `job.remove()`; em andamento,
  `worker.cancelJob(id)`, que dispara o `AbortSignal` que os conversores já recebem
  (terceiro argumento do processador). Concluído: só apaga a pasta e o job. Conferir
  `cancelJob` na versão instalada; se não existir, um `Map<id, AbortController>` no
  próprio processo resolve, já que API e worker dividem o processo.
- Sem Redis, o servidor sobe mesmo assim; só `convert` falha.
- A limpeza de pastas com mais de 24 h continua. Um job retomado depois de um reinício
  tem menos de 24 h, então a pasta dele ainda existe.
- O caminho dos arquivos sai do id (`<TMP_ROOT>/<id>/out`), sem depender da memória;
  o id é validado como UUID antes.
- Redis fora do ar: `convert` responde erro "Fila de conversão indisponível. Verifique o
  Redis." e a linha da camada mostra a mensagem.
- As rotas e as respostas para o frontend não mudam, exceto o resultado (8.3).

### 8.2 KMZ no servidor

- Conversor novo `kmz`: descompacta, lê o KML, separa pontos e linhas, simplifica as
  linhas, mede a extensão em km e limpa os atributos. É o código que hoje está em
  `src/lib/kmz.ts`, `src/lib/kmlAttributes.ts`, `src/features/points/kmzToPoints.ts` e
  `src/features/trechos/kmzToTrechos.ts`, movido para o servidor sem mudar a regra.
- Roda numa thread separada (`worker_threads`), como o IFC: ler XML grande trava o
  processo, e travaria envios e downloads.
- Limite de 1 GB para `.kmz`; assinatura `PK` (zip).
- Saída: `layer.geojson` com cada feição carregando `kind` (`point` ou `line`), `name`,
  `color`, `attributes` e, nas linhas, `extensaoKm`. Servido pela mesma rota `/files/*`.
- O frontend baixa o GeoJSON e o separa em `MapPoint[]` e `Trecho[]`, na thread
  principal: com geometria já simplificada e cerca de 1.400 itens, é rápido. Se um KMZ
  real travar a tela, essa separação vai para um worker.

### 8.3 Resultado da conversão

```ts
interface JobResult {
  format: "geojson" | "frag" | "glb" | "pointcloud";
  url: string;
  center: { lng: number; lat: number } | null;   // para o local do projeto
  placement?: { position: { lng: number; lat: number }; bearingDeg: number;
                localOrigin: [number, number, number] };   // só nuvem
}
```

- KMZ: `center` = centro da caixa de todas as feições.
- LAS/LAZ: leitura do cabeçalho e do CRS (hoje `lasHeader.ts` e `crs.ts` no navegador)
  passa para o servidor, lendo do disco. `center` = `placement.position`.
- IFC: `center` vem do `IfcSite` (latitude/longitude), lido do texto do IFC.
- GLB: `center` nulo.

## 9. O que sai do frontend

- `src/lib/kmz.ts`, `src/lib/kmlAttributes.ts`, `src/features/points/kmzToPoints.ts`,
  `src/features/trechos/{kmzToTrechos.ts,kmzTrechos.worker.ts,importTrechosKmz.ts}`,
  `src/features/models3d/{lasHeader.ts,crs.ts}`.
- Dependências: `jszip`, `@tmcw/togeojson`, `@xmldom/xmldom`, `@turf/turf`, `proj4`.
- O tipo de pasta (`FolderKind`, `FOLDER_KINDS`, `AddLayerMenu`) deixa de existir.

## 10. Testes

- `server/tests/files.test.ts`: ajustado ao caminho pelo id.
- `tests/crs.test.ts` muda para `server/tests/` junto com `crs.ts`.
- Nenhum teste novo. Verificação manual: criar projeto com e sem local; importar um KMZ,
  um IFC, a nuvem real e um GLB no mesmo projeto; reiniciar o servidor no meio de uma
  conversão e ver que ela termina; cancelar na fila e em andamento; marcador some no zoom
  16 e pelo botão.

## 11. Deixado para quem implementa

- Nomes dos componentes e arquivos novos do painel.
- Como montar o modo "Marcar no mapa".
- Detalhes de Tailwind para chegar ao mockup.
- Leitura do `IfcSite` no texto do IFC (o arquivo é lido em pedaços, como no conversor).

## 12. Decisões tomadas pelo Claude (não confirmadas pelo Henrique)

- Tarefa 6 da entrega 1 concluída antes desta reformulação.
- IBM Plex Sans no app inteiro.
- Rodapé só com "Novo projeto"; importação dentro de cada projeto.
- Todos os elementos do KMZ listados, sem "mostrar mais".
- Zoom 16 para esconder o marcador e para o voo até o projeto.
- `.frag` continua sem passar pelo servidor.
- API e worker no mesmo processo, uma conversão por vez, sem nova tentativa automática
  além da retomada de job travado.
- Data padrão do novo projeto: hoje.
- Modelo sem posição própria nasce no local do projeto, não no centro do mapa.
- Marcador some no zoom 16 só em projeto com modelo ou nuvem ligado.
- Importação de vários arquivos de uma vez.
- KMZ convertido em thread separada, limite de 1 GB; GeoJSON separado na thread
  principal do navegador.
- Status depois do envio lido do BullMQ; servidor sobe sem Redis e só a conversão falha.
