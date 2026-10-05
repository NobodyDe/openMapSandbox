import { useCallback, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Folder, Upload } from "lucide-react";
import type { ModelStatus } from "../models3d/models";
import { FileImportButton } from "./FileImportButton";
import { FOLDER_KINDS } from "./folderKinds";
import { LayerRow } from "./LayerRow";
import { VisibilityButton } from "./VisibilityButton";
import type { LayerFoldersState } from "./useLayerFolders";
import type { FolderItem, LayerFolder } from "./types";

interface FolderSectionProps {
  folder: LayerFolder;
  items: FolderItem[]; // já filtrados pela pesquisa e pela aba
  open: boolean;
  onToggleOpen: () => void;
  layers: LayerFoldersState;
  modelStatus: Record<string, ModelStatus>;
  renderDetails: (item: FolderItem) => ReactNode;
}

export function FolderSection({
  folder,
  items,
  open,
  onToggleOpen,
  layers,
  modelStatus,
  renderDetails,
}: FolderSectionProps) {
  // só um item aberto por pasta: só a tabela/calibração dele existe no DOM
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggleExpanded = useCallback(
    (id: string) => setExpandedId((current) => (current === id ? null : id)),
    [],
  );
  const { accept, importLabel } = FOLDER_KINDS[folder.kind];
  // contagem sobre a pasta inteira, não só sobre o que a pesquisa mostra
  const allIds = (folder.items as FolderItem[]).map((item) => item.id);
  const visibleCount = allIds.filter((id) => !layers.hiddenIds.has(id)).length;

  return (
    <section>
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {open ? <ChevronDown size={16} className="shrink-0 text-slate-500" /> : <ChevronRight size={16} className="shrink-0 text-slate-500" />}
          <Folder size={18} className="shrink-0 text-amber-600" />
          <span className="truncate text-sm font-semibold text-slate-800">{folder.name}</span>
          <span className="shrink-0 text-xs text-slate-500">
            {visibleCount}/{allIds.length}
          </span>
        </button>
        {/* algum visível → desliga a pasta toda; todos ocultos → liga todos */}
        <VisibilityButton
          hidden={allIds.length > 0 && visibleCount === 0} // pasta vazia não aparece como desligada
          onClick={() => layers.setHidden(allIds, visibleCount > 0)}
        />
      </div>

      {open && (
        <>
          <ul>
            {items.map((item) => {
              const hidden = layers.hiddenIds.has(item.id);
              return (
                <LayerRow
                  key={item.id}
                  kind={folder.kind}
                  item={item}
                  hidden={hidden}
                  status={hidden ? undefined : modelStatus[item.id]}
                  expanded={expandedId === item.id}
                  onToggleHidden={layers.toggle}
                  onToggleExpanded={toggleExpanded}
                  details={expandedId === item.id && renderDetails(item)}
                />
              );
            })}
          </ul>
          <div className="py-1.5 pl-9 pr-3">
            <FileImportButton
              accept={accept}
              onFile={(file) => layers.importFile(folder.id, file)}
              className="flex items-center gap-2 rounded-md border border-dashed border-slate-300 px-3 py-2 text-slate-600 hover:bg-slate-50"
            >
              <Upload size={16} />
              <span className="flex-1 text-sm">{importLabel}</span>
              <span className="text-xs text-slate-400">{accept}</span>
            </FileImportButton>
          </div>
        </>
      )}
    </section>
  );
}
