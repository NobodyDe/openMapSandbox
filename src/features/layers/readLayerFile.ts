import { readKmz } from "../../lib/kmz";
import type { Model3dConfig, ModelFormat } from "../models3d/models";
import { featuresToPoints } from "../points/kmzToPoints";
import { importTrechosKmz } from "../trechos/importTrechosKmz";
import type { FolderItems, FolderKind } from "./types";

// Formato que o servidor devolve depois de converter cada extensão
const CONVERTED_FORMAT: Record<string, ModelFormat> = { ifc: "frag", glb: "glb", las: "pointcloud", laz: "pointcloud" };

// .frag local: o Model3dLayer baixa pela URL, e uma URL "blob:" aponta para o arquivo na memória.
// A posição vem do IfcSite do próprio arquivo e se ajusta na calibração.
// Os outros formatos entram sem URL: ela chega quando o servidor termina de converter
function readModelFile(file: File): Model3dConfig {
  const id = crypto.randomUUID();
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const name = file.name.replace(/\.[^.]+$/, "");
  if (extension === "frag") return { id, name, format: "frag", url: URL.createObjectURL(file) };
  return { id, name, format: CONVERTED_FORMAT[extension] };
}

// Um leitor por tipo de pasta: arquivo escolhido → itens prontos para o mapa
const READERS: { [K in FolderKind]: (file: File) => Promise<FolderItems[K]> } = {
  points: async (file) => featuresToPoints(await readKmz(file)),
  trechos: importTrechosKmz,
  models: async (file) => [readModelFile(file)],
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
