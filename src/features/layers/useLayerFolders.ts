import { useCallback, useState } from "react";
import { MODELS_3D } from "../models3d/models";
import { readLayerFile } from "./readLayerFile";
import type { FolderItem, FolderItems, FolderKind, LayerFolder } from "./types";

const DEFAULT_FOLDERS: LayerFolder[] = [
  { id: "trechos", name: "Trechos", kind: "trechos", items: [] },
  { id: "pontos", name: "Pontos", kind: "points", items: [] },
  { id: "modelos", name: "Modelos 3D", kind: "models", items: MODELS_3D },
];

// Todos os itens de um tipo, somando as pastas (o mapa desenha tudo junto)
export function itemsOfKind<K extends FolderKind>(folders: LayerFolder[], kind: K): FolderItems[K] {
  // cast: o filtro por kind garante o tipo, mas o TS não acompanha isso dentro do flatMap
  return folders.flatMap<FolderItem>((folder) => (folder.kind === kind ? folder.items : [])) as FolderItems[K];
}

// Estado das camadas: as pastas com seus itens e quais itens estão ocultos no mapa
export function useLayerFolders() {
  const [folders, setFolders] = useState(DEFAULT_FOLDERS);
  // Um conjunto só para tudo (os ids são únicos entre pastas). Modelos começam desligados:
  // cada um baixa vários MB, então só carrega quando o usuário pede
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(
    () => new Set(MODELS_3D.map((model) => model.id)),
  );

  // useCallback + atualização funcional: as funções nunca mudam, e as linhas do painel (memo)
  // não re-renderizam todas a cada clique
  const setHidden = useCallback((ids: string[], hidden: boolean) => {
    setHiddenIds((prev) => {
      const next = new Set(prev); // cópia: o React só re-renderiza se a referência mudar
      for (const id of ids) {
        if (hidden) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const toggle = useCallback((id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function addFolder(name: string, kind: FolderKind) {
    const folder = { id: crypto.randomUUID(), name, kind, items: [] } as LayerFolder;
    setFolders((prev) => [...prev, folder]);
  }

  // KMZ substitui o conteúdo da pasta; modelo 3D soma (cada arquivo é um modelo)
  async function importFile(folderId: string, file: File) {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;
    const items = await readLayerFile(folder.kind, file, folderId);
    setFolders((prev) =>
      prev.map((f) =>
        f.id !== folderId ? f : ({ ...f, items: f.kind === "models" ? [...f.items, ...items] : items } as LayerFolder),
      ),
    );
    // O que acabou de entrar aparece no mapa (e limpa flags antigas de ids reaproveitados)
    setHidden(items.map((item) => item.id), false);
  }

  return { folders, hiddenIds, toggle, setHidden, addFolder, importFile };
}

export type LayerFoldersState = ReturnType<typeof useLayerFolders>;
