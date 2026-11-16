# Carregamento de arquivos 3D grandes (.las, .ifc, .glb) — design

Data: 2026-11-16
Status: aguardando aprovação

## 1. Intenção

O usuário escolhe no frontend um arquivo `.las`/`.laz`, `.ifc` ou `.glb` de até 3 GB.
O sistema converte o arquivo e o mostra no mapa, na posição geográfica correta.
A partir do item no mapa, o usuário abre um popup com um visualizador 3D do objeto,
onde faz cortes e medições.

Os arquivos reais são: nuvem de pontos de drone, IFC de prédio e de rodovia, GLB de
modelagem. O foco é performance (o mapa não pode travar) e usabilidade (o usuário
sempre sabe o que está acontecendo com o arquivo).

Nesta fase não há armazenamento permanente. Só conversão e visualização. Um storage
entra depois.

## 2. Objetivos, não-objetivos, anti-objetivos

### Objetivos

- Aceitar `.las`, `.laz`, `.ifc`, `.glb` de até 3 GB pelo painel de camadas, além do
  `.frag` que já funciona.
- Upload em pedaços, com progresso, velocidade e tempo restante. Falha de rede em um
  pedaço refaz só aquele pedaço.
- Conversão no servidor com progresso visível e botão de cancelar.
- O item aparece no painel assim que o arquivo é escolhido, com o estado atual
  (enviando, na fila, convertendo, carregando, pronto, erro).
- Posição automática quando o arquivo traz georreferência. Calibração manual sempre
  disponível.
- Mapa interativo com uma nuvem de 3 GB carregada: a nuvem é lida por nível de
  detalhe, com teto de pontos na tela.
- Popup 3D para os três formatos, com órbita, cortes e medição de distância.

### Não-objetivos (ficam fora desta feature)

- Armazenamento permanente, lista de arquivos enviados antes, login, multiusuário.
- Formatos `.e57`, `.ply`, 3D Tiles, COPC.
- Divisão de malha GLB em tiles ou LOD de malha.
- IFC que estoura o limite de memória do conversor (ver seção 9): falha com mensagem
  clara, sem conversor alternativo.
- Gizmo de arrastar/girar o modelo no mapa. A calibração continua sendo o painel
  numérico atual.
- Coloração por classificação/intensidade da nuvem. Entra depois, se pedido.
- Datum vertical e geoide. O mapa não tem relevo.
- Georreferência por `IfcMapConversion` e campo para digitar o EPSG à mão. Nenhum
  arquivo real precisa deles hoje, e sem arquivo não há como conferir. Entram quando
  aparecer um arquivo que precise; até lá esses casos caem na calibração manual.

### Anti-objetivos (se acontecer, a feature falhou mesmo "funcionando")

- Carregar o arquivo inteiro na memória do navegador.
- Travar o mapa durante upload, conversão ou carregamento.
- Converter o mesmo arquivo duas vezes (uma para o mapa, outra para o popup).
- Quebrar a importação de `.frag` ou a troca globo/Mercator que existem hoje.
- Deixar o usuário sem saber se o arquivo está subindo, convertendo ou falhou.

## 3. Restrições

- Frontend atual: React 19, Vite 8, MapLibre GL 6, three 0.186, `@thatopen/fragments`
  3.4.7, pnpm. O 3D é desenhado numa `CustomLayerInterface` que divide o contexto
  WebGL com o mapa (`src/features/models3d/createFragmentsLayer.ts`).
- O mapa alterna entre globo e Mercator. Cada modelo tem duas matrizes
  (`src/features/models3d/georef.ts`) e a camada escolhe uma a cada quadro.
- O mapa não tem relevo: altitude 0 é o chão.
- Sem storage permanente agora.
- Nesta fase o servidor roda na máquina Windows do Henrique, com um usuário só.
  No futuro vai para uma VM Linux: nada no código pode depender de Windows
  (caminhos montados com `node:path`, binário do conversor vindo de variável de
  ambiente).
- Node 24 na máquina de desenvolvimento.

### Arquivos reais de teste

Pasta `C:\Users\henrique.santos\Downloads\modelos` (inspecionada em 2026-11-16):

| Arquivo | Tamanho | O que traz |
|---|---|---|
| `BASE_AP0_5cm_1.las` | 1,87 GB | LAS 1.4, formato de ponto 8, cerca de 49 milhões de pontos. CRS EPSG:32722 (WGS 84 / UTM 22S) em GeoKeys e em WKT. Cotas de 132 a 181 m |
| `081-26-SONDOTÉCNICA_R08-IFC4X3.ifc` | 211 MB | IFC4X3_ADD2, exportado do SketchUp. `IfcSite` sem latitude/longitude. Sem `IfcMapConversion` |
| `HOTEL_FAIRMONT (1).ifc` | 181 MB | IFC4X3_ADD2, exportado do Revit. `IfcSite` com latitude/longitude. Sem `IfcMapConversion` |
| três `.glb` | 10 a 12 MB cada | modelagem |
| `ifc-sample-models-main/sample-models/*.ifc` | pequenos | amostras públicas |

Consequência: o caso pesado real é a nuvem. IFC e GLB reais estão longe dos limites
da seção 9.

## 4. Abordagens consideradas

### A. Formatos nativos do three.js, backend Node — ESCOLHIDA

- LAS/LAZ: `PotreeConverter` 2.1 (binário C++, BSD-2) gera um octree de três
  arquivos. O navegador lê por requisições Range com `potree-core` (MIT).
- IFC: `IfcImporter` do `@thatopen/fragments` em Node gera `.frag`, formato que o
  projeto já renderiza.
- GLB: `gltf-transform` comprime; `GLTFLoader` carrega.
- Custo: três leitores na mesma cena; IFC acima do limite do WASM falha.

### B. 3D Tiles para tudo, backend Python (caminho do geobim)

- Um renderizador só (`3d-tiles-renderer`), um corte, uma medição.
- Custo: não há conversor aberto de IFC ou de malha para 3D Tiles com LOD (o do
  geobim é fechado). Perde o `.frag` que já funciona. Duas linguagens.

### C. COPC, backend mínimo (caminho do GeoLibre)

- Nuvem em um único `.copc.laz`, padrão aberto.
- Custo: não há leitor COPC pronto para three; seria preciso escrever o renderizador.
  `maplibre-gl-lidar` força Mercator e quebra o globo.

### Por que A

Escolha do Henrique. É a menor mudança: mantém three, Fragments e a camada custom.
Não exige Python. O Potree entra onde faz sentido: o conversor no servidor e o
`potree-core` no navegador, só para nuvem de pontos. O viewer do Potree não é usado,
porque é uma aplicação fechada, não uma biblioteca.

## 5. Visão geral

```
navegador                                   servidor (Node)
---------                                   ---------------
escolhe arquivo
lê cabeçalho (CRS do LAS)
POST /api/jobs ───────────────────────────► cria pasta temporária do job
PUT  /api/jobs/:id/chunks/:n  (em paralelo)► grava cada pedaço no offset certo
POST /api/jobs/:id/convert ───────────────► entra na fila (1 conversão por vez)
GET  /api/jobs/:id  (a cada 2 s) ◄───────── estado + progresso
                                            conversor por formato → out/
GET  /api/jobs/:id/files/... (Range) ◄───── arquivos convertidos
carrega no mapa → popup 3D
DELETE /api/jobs/:id ─────────────────────► apaga a pasta
```

Fronteira: o servidor só recebe, converte e serve arquivos. Toda a georreferência
fica no frontend, num lugar só.

## 6. Entregas

A feature sai em três entregas, nesta ordem. Cada uma tem seu próprio plano de
implementação e termina utilizável.

1. **Upload, conversão e objeto no mapa** para os três formatos.
2. **Popup 3D** com órbita.
3. **Cortes e medição** no popup.

A entrega 1 começa por dois testes rápidos com arquivo real (seção 9, riscos 1 e 2),
antes de qualquer outra tarefa. O resultado deles pode mudar o resto.

## 7. Servidor

### 7.1 Onde fica

Pasta `server/` no repositório do openMapSandbox, com `package.json` próprio (as
dependências são diferentes das do frontend). Node + TypeScript + Fastify.
A versão do `@thatopen/fragments` no servidor é a mesma do frontend (3.4.7): o `.frag`
gerado precisa ser lido pelo mesmo leitor.

Em desenvolvimento, o Vite encaminha `/api` para o servidor (porta 3334). Fora do
desenvolvimento, o próprio servidor entrega o frontend já compilado (`dist/`). Nos
dois casos o frontend chama caminhos relativos `/api/...` na mesma origem, então não
há CORS a configurar.

Se o servidor não responde, a importação de `.ifc`, `.glb`, `.las` e `.laz` mostra
erro na linha do item. O `.frag` e o resto do mapa continuam funcionando.

### 7.2 Rotas

| Método | Rota | O que faz |
|---|---|---|
| POST | `/api/jobs` | corpo `{ name, size }`. Valida extensão e tamanho. Responde `{ jobId, chunkSize }` |
| PUT | `/api/jobs/:id/chunks/:index` | corpo binário. Grava no offset `index × chunkSize`. Repetir o mesmo pedaço é seguro |
| POST | `/api/jobs/:id/convert` | confere que todos os pedaços chegaram e os bytes mágicos; põe na fila |
| GET | `/api/jobs/:id` | `{ state, progress, message, result }` |
| DELETE | `/api/jobs/:id` | cancela a conversão em andamento e apaga a pasta |
| GET | `/api/jobs/:id/files/*` | arquivos convertidos, com suporte a Range |

Estados: `uploading`, `queued`, `converting`, `done`, `error`.
`progress` é de 0 a 1, ou `null` quando o conversor não informa.

`result` quando `done`:

- nuvem: `{ format: "pointcloud", url: ".../files/metadata.json" }`
- IFC: `{ format: "frag", url: ".../files/model.frag" }`
- GLB: `{ format: "glb", url: ".../files/model.glb" }`

Tamanho do pedaço: 16 MB. O frontend envia 3 pedaços em paralelo.

Upload próprio em pedaços, e não o protocolo tus: são poucas linhas dos dois lados e
não há retomada entre recargas de página sem storage. Trocar por tus quando o
storage permanente chegar.

### 7.3 Pasta temporária

`<TMP_ROOT>/<jobId>/` contém `input.<ext>`, `job.json` e `out/`.

- `TMP_ROOT` vem de variável de ambiente; padrão é a pasta temporária do sistema.
- O `input` é apagado quando a conversão termina com sucesso.
- Pastas com mais de 24 h são apagadas na partida do servidor e de hora em hora.
- O frontend chama `DELETE` quando o usuário remove o item ou cancela.

Quando o storage chegar, muda só o destino de `out/`. As rotas não mudam.

### 7.4 Fila

Uma conversão por vez, em fila na memória do processo. Conversões usam muita CPU e
memória; duas de 3 GB juntas derrubam a máquina. Se o servidor reiniciar, os jobs
que estavam na fila ou convertendo passam a `error`.

### 7.5 Conversores

Cada formato é um módulo com a mesma assinatura: recebe o caminho do arquivo, a
pasta de saída, uma função de progresso e um sinal de cancelamento.

**Nuvem de pontos (`.las`, `.laz`)**
Executa o binário `PotreeConverter <input> -o <out>`. O caminho do binário vem da
variável `POTREE_CONVERTER_PATH`. O progresso é lido da saída do processo, se ele
informar; senão `progress` fica `null`. Cancelar mata o processo.
Saída: `metadata.json`, `hierarchy.bin`, `octree.bin`.

**IFC**
Roda `IfcImporter.process` numa thread separada (`worker_threads`), lendo o arquivo
do disco com `readFromCallback`/`readCallback`, sem carregá-lo inteiro na memória.
O progresso vem do `progressCallback`. Cancelar encerra a thread.
Saída: `model.frag`.

**GLB**
`gltf-transform`: remove duplicados e itens sem uso, comprime a geometria com
meshopt e reduz texturas para no máximo 2048 px. Saída: `model.glb`.

### 7.6 Validação e segurança

- Extensão numa lista fixa; bytes mágicos conferidos antes de converter
  (`LASF`, `glTF`, `ISO-10303-21`).
- Tamanho declarado limitado a 3 GB; o servidor recusa gravar além do declarado.
- Índice do pedaço dentro do intervalo esperado.
- `jobId` é um UUID gerado pelo servidor. O caminho pedido em `/files/*` é
  resolvido e conferido para não sair da pasta `out/` do job.
- Sem cabeçalhos CORS: frontend e API ficam na mesma origem (seção 7.1).

**Aviso:** não há login. Um endpoint que aceita uploads de 3 GB sem autenticação não
pode ficar exposto à internet. Nesta fase o servidor roda local ou em rede interna.
Publicar exige autenticação antes.

## 8. Frontend

### 8.1 Importação e estado do item

- A pasta "Modelos 3D" passa a aceitar `.frag,.ifc,.glb,.las,.laz`.
- `Model3dConfig` ganha `format: "frag" | "pointcloud" | "glb"`. Itens sem o campo
  são `frag`, como hoje.
- `.frag` continua indo direto para o navegador, sem servidor.
- Os outros formatos: o item entra no painel na hora, e um fluxo próprio cuida de
  enviar, acompanhar o job e, no fim, preencher a `url` do item.
- `ModelStatus` passa a incluir `uploading`, `queued` e `converting`, com o
  progresso. A linha do item mostra o estado, a porcentagem e um botão de cancelar.
- Erro mostra a mensagem do servidor na linha do item, não num `alert`.
- A linha de um modelo ganha a ação "remover", que hoje não existe. Remover tira o
  item do painel e chama `DELETE` no job. Ocultar continua só descarregando o modelo
  da memória, sem apagar os arquivos convertidos.
- Cancelar um envio ou uma conversão remove a linha.

### 8.2 Camada 3D no mapa

Hoje `createFragmentsLayer` recebe um `FragmentsModel`. Passa a receber um objeto
comum aos três formatos:

- o `Object3D` a desenhar;
- uma função opcional chamada a cada quadro (Fragments e nuvem atualizam o nível de
  detalhe ali);
- uma função de descarte.

Há um carregador por formato que devolve esse objeto. O `Model3dLayer` escolhe o
carregador pelo `format`. O resto (matrizes, âncora, voo até o modelo) não muda.

- **frag:** como hoje.
- **glb:** `GLTFLoader` com o decodificador meshopt.
- **pointcloud:** `potree-core`. No mapa, tamanho de ponto fixo e teto de 2 milhões
  de pontos. O Z para cima do LAS é convertido para o Y para cima que as matrizes
  atuais esperam.

Recentralização, para os três formatos: se o centro da caixa envolvente do objeto
está longe da origem local (coordenadas UTM gravadas direto na geometria), o objeto
é reposicionado para que esse centro, na base, fique na origem. Isso evita perda de
precisão e o objeto aparecer a milhares de quilômetros da âncora. As coordenadas
originais do centro são guardadas para a georreferência (seção 8.3).

A camada atual coloca a matriz completa do mapa na matriz de projeção da câmera.
Para desenhar, isso basta. Para o `potree-core` escolher o nível de detalhe, ele
precisa de uma câmera com posição real em metros no espaço do modelo. A camada
calcula essa segunda câmera a partir da inversa da matriz do quadro e a entrega só
para a atualização do nível de detalhe. Este é o risco 1 (seção 9).

### 8.3 Georreferência

Toda a conversão de coordenadas fica num módulo do frontend. Ordem de prioridade
para a posição inicial:

| Formato | Fonte | Sem ela |
|---|---|---|
| nuvem | CRS do cabeçalho LAS + centro da caixa envolvente | centro do mapa |
| IFC | `IfcSite` (leitura que já existe) | centro do mapa |
| GLB | — | centro do mapa |

- O cabeçalho do LAS é lido no navegador, do próprio `File`, antes do upload. Assim o
  usuário vê o CRS detectado antes de esperar o envio. A leitura das VLRs (GeoKeys
  34735 e WKT 2112) segue a lógica de
  `GeoLibre/packages/map/src/cesium-point-cloud.ts` (MIT).
- Conversão com `proj4`. CRS aceitos: WKT quando o arquivo traz, e códigos EPSG de
  UTM WGS84 (326xx/327xx) e UTM SIRGAS 2000 (31965–31985), montados por fórmula.
  Outro EPSG cai em posição manual, com aviso dizendo qual código não foi
  reconhecido. Trocar por uma tabela EPSG completa quando aparecer outro CRS.
- Rotação: em CRS projetado, o "norte" da grade não é o norte verdadeiro. O módulo
  calcula o ângulo de convergência no centro do objeto e o usa como `bearingDeg`
  inicial.
- Altitude: o mapa não tem relevo, então uma nuvem com cotas reais (700 m, por
  exemplo) flutuaria. A altitude inicial coloca a base do objeto no chão
  (altitude 0). O usuário ajusta no painel de calibração.
- A calibração manual atual vale para os três formatos, sem mudança.

### 8.4 Popup 3D (entrega 2)

- Aberto por um botão na linha do item no painel de camadas.
- Janela modal com canvas próprio, renderizador próprio, câmera em perspectiva e
  controle de órbita. Coordenadas locais do objeto, em metros.
- Usa a mesma `url` e os mesmos carregadores da seção 8.2. Não há segunda conversão.
- Enquanto o popup está aberto, a camada desse item no mapa fica suspensa, para a
  memória de vídeo não dobrar. Ao fechar, a camada volta.
- No popup a nuvem usa tamanho de ponto adaptativo e teto de 5 milhões de pontos.
- O servidor envia cabeçalhos de cache nos arquivos convertidos, para a reabertura
  não baixar tudo de novo.

### 8.5 Cortes e medição (entrega 3)

Só no popup.

- **Corte:** um plano por eixo (X, Y ou Z), com controle de posição e botão de
  inverter o lado. Um estado único de corte é aplicado por formato: planos de corte
  do three para `.frag` e GLB; planos de corte do `potree-core` para a nuvem.
- **Medição:** distância em metros entre dois pontos clicados. O clique é resolvido
  por formato: `raycast` do Fragments, `Raycaster` do three para GLB, seleção de
  ponto do `potree-core` para a nuvem.

## 9. Riscos e limites conhecidos

1. **Nível de detalhe do `potree-core` sob a câmera do MapLibre.** Não foi testado.
   Primeira tarefa da entrega 1: teste rápido com `BASE_AP0_5cm_1.las`, em globo e
   em Mercator. O mesmo teste confere se o `PotreeConverter` aceita LAS 1.4 com
   formato de ponto 8. Critério, confirmado pelo Henrique: 30 fps navegando, em
   notebook com placa integrada, com teto de 2 milhões de pontos. Se não passar, a alternativa é escrever um leitor próprio do octree
   do Potree 2 (o formato é simples) reaproveitando a seleção de nós de
   `GeoLibre/packages/map/src/cesium-point-cloud-stream.ts`.
2. **`IfcImporter` com IFC grande.** O conversor usa WASM, com teto de 4 GB de
   memória. Os IFC reais têm cerca de 200 MB e são IFC4X3_ADD2. Segunda tarefa da
   entrega 1: converter os dois e conferir que o `.frag` abre no mapa. Acima do
   limite, o job termina em `error`
   com mensagem explicando. Um conversor nativo (IfcOpenShell, em Python) fica como
   projeto futuro.
3. **GLB muito grande.** O navegador carrega o GLB inteiro. Se, depois de
   comprimido, o arquivo passar de 1 GB, o job termina em `error` com mensagem
   explicando. GLB de modelagem não deve chegar perto disso.
4. **Seleção de ponto do `potree-core`** não está documentada no README. A medição
   em nuvem depende dela. Conferir no código da biblioteca no início da entrega 3.
5. **`PotreeConverter` em Linux.** Há binário para Windows; para Linux pode ser
   preciso compilar. Resolver ao preparar o ambiente do servidor.
6. **Disco.** Cada job ocupa até cerca de duas vezes o tamanho do arquivo durante a
   conversão.

## 10. O que vem dos projetos de apoio

| De onde | O que | Como |
|---|---|---|
| GeoLibre (MIT) | leitura de CRS do LAS: `packages/map/src/cesium-point-cloud.ts` linhas 533–584 e 746–773 | portar o trecho |
| GeoLibre (MIT) | seleção de nós do octree: `packages/map/src/cesium-point-cloud-stream.ts` | só se o risco 1 se confirmar |
| GeoLibre (MIT) | validação de GLB: `apps/geolibre-desktop/src/lib/local-gltf.ts` | referência para os bytes mágicos |
| geobim (MPL-2.0) | protocolo de job: pasta por job, estados, uma conversão por vez, consulta periódica (`scripts/convert_pointcloud.py`, `api/pointcloud-upload.php`) | reimplementar a ideia, sem copiar arquivo |
| geobim (MPL-2.0) | progresso de upload com velocidade e tempo restante (`pointcloud-upload.js`) | reimplementar a ideia |
| Potree (BSD-2) | `PotreeConverter` | binário chamado pelo servidor |
| potree-core (MIT) | leitor do octree para three | dependência do frontend |

Arquivos do geobim copiados continuariam sob MPL-2.0. Por isso dele só se
reaproveitam ideias.

## 11. Testes

Pouco teste, por decisão do Henrique: o foco é a entrega principal.

- Testes automáticos só em dois pontos, com o `node:test` que já vem no Node (sem
  dependência nova): a proteção de caminho em `/files/*` (segurança) e a conversão
  de CRS para longitude/latitude (um erro ali põe o objeto no lugar errado sem
  avisar).
- Todo o resto: verificação manual com arquivo real de cada tipo, em globo e em
  Mercator.

## 12. Deixado para quem implementa

- Estrutura interna de `server/` e nomes de arquivos e funções.
- Como ler o progresso da saída do `PotreeConverter`.
- Como calcular a câmera de nível de detalhe a partir da matriz do quadro.
- Aparência da linha do item (barra, porcentagem, botão de cancelar) e do popup,
  seguindo o estilo Tailwind do painel atual.
- Valores exatos de cabeçalhos de cache.
- Opções finas do `gltf-transform` e do `IfcImporter`.

## 13. Como será implementado (decidido pelo Henrique)

- **Código simples.** Simples de ler, de manter e de crescer, sem complexidade
  desnecessária. Toda escrita de código segue a skill `simple-solid-code`: funções
  pequenas com uma responsabilidade, nenhuma abstração que ninguém pediu, e uma
  explicação do porquê de cada escolha.
- **Quem escreve o código.** Um agente rodando Opus 5.5 aplica o código. O plano e a
  revisão final ficam com a sessão principal.
- **Economia de tokens.** Plano curto. Um agente por entrega, sem agente de revisão
  por tarefa. Pouco teste (seção 11).
- **Mapa de pastas.** Ao fim de cada entrega, o Henrique recebe a lista das pastas e
  arquivos criados ou alterados, com o que cada um faz e por que existe.

## 14. Decisões tomadas pelo Claude (não confirmadas pelo Henrique)

- `IfcMapConversion` e campo de EPSG manual adiados (seção 2), porque nenhum arquivo
  real precisa deles.

- `.laz` aceito junto com `.las` (o conversor já lê os dois).
- "Sem storage" tratado como pasta temporária no servidor, apagada em 24 h.
- Fastify no servidor; `server/` dentro do mesmo repositório.
- Upload próprio em pedaços de 16 MB, 3 em paralelo, em vez de tus.
- Uma conversão por vez.
- Georreferência toda no frontend; cabeçalho LAS lido no navegador antes do upload.
- CRS aceitos limitados a WKT e UTM WGS84 / SIRGAS 2000.
- Base do objeto colocada no chão do mapa por padrão.
- Teto de pontos: 2 milhões no mapa, 5 milhões no popup.
- Camada do mapa suspensa enquanto o popup do mesmo item está aberto.
- Um plano de corte por vez; medição só de distância.
- Limite de 1 GB para o GLB já comprimido.
- Três entregas, com um plano de implementação por entrega.
- Servidor entrega o frontend compilado fora do desenvolvimento (mesma origem).
- Ação "remover" na linha do modelo; cancelar remove a linha.
- Recentralização para os três formatos.
