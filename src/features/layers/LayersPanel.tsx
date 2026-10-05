import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, FolderPlus, Plus, Power, Search } from "lucide-react";
import { AttributesTable } from "../../components/AttributesTable";
import type { Model3dConfig, ModelStatus } from "../models3d/models";
import { AddLayerMenu } from "./AddLayerMenu";
import { FolderSection } from "./FolderSection";
import { describeItem } from "./layerItemText";
import { NewFolderForm } from "./NewFolderForm";
import type { LayerFoldersState } from "./useLayerFolders";
import type { FolderItem, FolderKind, LayerFolder } from "./types";

type Tab = "all" | "active";
type FooterForm = "newFolder" | "addLayer" | null;

// Itens da pasta que passam na pesquisa e na aba. Se o NOME da pasta casa com a pesquisa,
// a pasta aparece inteira
function filterItems(folder: LayerFolder, query: string, onlyActive: boolean, hiddenIds: ReadonlySet<string>) {
  const folderMatches = folder.name.toLowerCase().includes(query);
  return (folder.items as FolderItem[]).filter((item) => {
    if (onlyActive && hiddenIds.has(item.id)) return false;
    if (!query || folderMatches) return true;
    const { label, detail } = describeItem(folder.kind, item);
    return `${label} ${detail}`.toLowerCase().includes(query);
  });
}

interface LayersPanelProps {
  layers: LayerFoldersState;
  modelStatus: Record<string, ModelStatus>;
  renderModelDetails: (model: Model3dConfig) => ReactNode; // a calibração vive no MapView
  onClose: () => void;
}

export function LayersPanel({ layers, modelStatus, renderModelDetails, onClose }: LayersPanelProps) {
  const { folders, hiddenIds } = layers;
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(new Set());
  const [footerForm, setFooterForm] = useState<FooterForm>(null);

  const search = query.trim().toLowerCase();
  const filtering = search !== "" || tab === "active";
  // Recalcula só quando algo que muda o resultado muda (não a cada pasta aberta/fechada)
  const shown = useMemo(
    () =>
      folders
        .map((folder) => ({ folder, items: filterItems(folder, search, tab === "active", hiddenIds) }))
        .filter(({ items }) => !filtering || items.length > 0), // filtrando: some pasta sem resultado
    [folders, search, tab, hiddenIds, filtering],
  );
  const allItemIds = useMemo(() => folders.flatMap((f) => (f.items as FolderItem[]).map((item) => item.id)), [folders]);
  const activeCount = allItemIds.filter((id) => !hiddenIds.has(id)).length;
  const allCollapsed = folders.every((folder) => collapsedIds.has(folder.id));

  function toggleFolderOpen(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFolders() {
    setCollapsedIds(allCollapsed ? new Set() : new Set(folders.map((folder) => folder.id)));
  }

  function renderDetails(item: FolderItem) {
    return "attributes" in item ? <AttributesTable attributes={item.attributes} /> : renderModelDetails(item);
  }

  // "Adicionar camada" vai para a primeira pasta daquele tipo (as padrão sempre existem)
  async function importIntoKind(kind: FolderKind, file: File) {
    const folder = folders.find((f) => f.kind === kind);
    if (!folder) return;
    await layers.importFile(folder.id, file);
    setFooterForm(null);
  }

  return (
    <aside className="absolute inset-y-0 left-0 z-20 flex w-[22rem] max-w-full flex-col bg-white shadow-xl">
      <header className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Camadas</h2>
          <p className="text-sm text-slate-500">Organize e controle o que aparece no mapa</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Fechar painel"
          aria-label="Fechar painel"
          className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100"
        >
          <ChevronLeft size={18} />
        </button>
      </header>

      <div className="space-y-3 px-4 pb-3">
        <label className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 focus-within:border-blue-600">
          <Search size={16} className="text-slate-500" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar camada ou pasta"
            aria-label="Pesquisar camada ou pasta"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>

        <div role="tablist" className="flex rounded-md bg-slate-100 p-1">
          {(["all", "active"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`flex flex-1 items-center justify-center gap-2 rounded py-1.5 text-sm ${
                tab === value ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-600"
              }`}
            >
              {value === "all" ? "Todas" : "Ativas"}
              {value === "active" && (
                <span className="rounded-full bg-blue-700 px-1.5 text-xs font-medium text-white">{activeCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-2 text-xs">
        <span className="flex-1 font-semibold tracking-wide text-slate-500">PASTAS</span>
        <button type="button" onClick={toggleAllFolders} className="font-medium text-blue-700 hover:underline">
          {allCollapsed ? "Expandir tudo" : "Recolher tudo"}
        </button>
        <span className="h-4 w-px bg-slate-200" />
        <button
          type="button"
          onClick={() => layers.setHidden(allItemIds, true)}
          className="flex items-center gap-1 font-medium text-blue-700 hover:underline"
        >
          <Power size={14} /> Desligar todas
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-2">
        {shown.map(({ folder, items }) => (
          <FolderSection
            key={folder.id}
            folder={folder}
            items={items}
            open={filtering || !collapsedIds.has(folder.id)} // pesquisando: abre para mostrar o resultado
            onToggleOpen={() => toggleFolderOpen(folder.id)}
            layers={layers}
            modelStatus={modelStatus}
            renderDetails={renderDetails}
          />
        ))}
        {shown.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-500">Nada encontrado.</p>}
      </div>

      <footer className="border-t border-slate-200 p-4">
        {footerForm === "newFolder" && (
          <NewFolderForm
            onCreate={(name, kind) => {
              layers.addFolder(name, kind);
              setFooterForm(null);
            }}
            onCancel={() => setFooterForm(null)}
          />
        )}
        {footerForm === "addLayer" && <AddLayerMenu onImport={importIntoKind} />}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFooterForm((form) => (form === "newFolder" ? null : "newFolder"))}
            aria-expanded={footerForm === "newFolder"}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <FolderPlus size={16} /> Nova pasta
          </button>
          <button
            type="button"
            onClick={() => setFooterForm((form) => (form === "addLayer" ? null : "addLayer"))}
            aria-expanded={footerForm === "addLayer"}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-blue-700 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            <Plus size={16} /> Adicionar camada
          </button>
        </div>
      </footer>
    </aside>
  );
}
