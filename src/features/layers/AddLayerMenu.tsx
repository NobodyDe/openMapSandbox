import { FileImportButton } from "./FileImportButton";
import { FOLDER_KINDS } from "./folderKinds";
import type { FolderKind } from "./types";

interface AddLayerMenuProps {
  onImport: (kind: FolderKind, file: File) => Promise<void>;
}

const KINDS = Object.keys(FOLDER_KINDS) as FolderKind[];

// "Adicionar camada": escolhe o tipo e o arquivo; vai para a primeira pasta daquele tipo
export function AddLayerMenu({ onImport }: AddLayerMenuProps) {
  return (
    <ul className="mb-3 overflow-hidden rounded-md border border-slate-200">
      {KINDS.map((kind) => {
        const { label, accept, icon: Icon } = FOLDER_KINDS[kind];
        return (
          <li key={kind} className="border-b border-slate-100 last:border-b-0">
            <FileImportButton
              accept={accept}
              onFile={(file) => onImport(kind, file)}
              className="flex items-center gap-3 px-3 py-2 text-slate-700 hover:bg-slate-50"
            >
              <Icon size={16} className="text-slate-500" />
              <span className="flex-1 text-sm">{label}</span>
              <span className="text-xs text-slate-400">{accept}</span>
            </FileImportButton>
          </li>
        );
      })}
    </ul>
  );
}
