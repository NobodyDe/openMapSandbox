import { readKmz } from "../../lib/kmz";
import { featuresToPoints } from "../points/kmzToPoints";
import { importTrechosKmz } from "../trechos/importTrechosKmz";
import type { FolderItems, FolderKind } from "./types";

// Um leitor por tipo de pasta: arquivo escolhido → itens prontos para o mapa
const READERS: { [K in FolderKind]: (file: File) => Promise<FolderItems[K]> } = {
  points: async (file) => featuresToPoints(await readKmz(file)),
  trechos: importTrechosKmz,
  // .frag local: o Model3dLayer baixa pela URL, e uma URL "blob:" aponta para o arquivo na memória.
  // A posição vem do IfcSite do próprio arquivo e se ajusta na calibração
  models: async (file) => [
    { id: crypto.randomUUID(), name: file.name.replace(/\.frag$/i, ""), url: URL.createObjectURL(file) },
  ],
};

// Prefixa os ids com a pasta: os ids do KMZ são só o índice ("0", "1"…) e duas pastas
// de trechos colidiriam na visibilidade, no hover e no popup
export async function readLayerFile<K extends FolderKind>(
  kind: K,
  file: File,
  folderId: string,
): Promise<FolderItems[K]> {
  const items = await READERS[kind](file);
  // cast: o .map sobre a união de arrays perde a ligação com K, mas o formato é o mesmo
  return items.map((item) => ({ ...item, id: `${folderId}/${item.id}` })) as FolderItems[K];
}
