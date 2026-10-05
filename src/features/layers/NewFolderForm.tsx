import { useState, type FormEvent } from "react";
import { FOLDER_KINDS } from "./folderKinds";
import type { FolderKind } from "./types";

interface NewFolderFormProps {
  onCreate: (name: string, kind: FolderKind) => void;
  onCancel: () => void;
}

const KIND_OPTIONS = Object.entries(FOLDER_KINDS) as [FolderKind, (typeof FOLDER_KINDS)[FolderKind]][];

export function NewFolderForm({ onCreate, onCancel }: NewFolderFormProps) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<FolderKind>("trechos");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed) onCreate(trimmed, kind);
  }

  return (
    <form onSubmit={handleSubmit} className="mb-3 space-y-2">
      <input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Nome da pasta"
        aria-label="Nome da pasta"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600"
      />
      {/* o tipo define o que a pasta importa (KMZ de pontos/trechos ou .frag) */}
      <select
        value={kind}
        onChange={(event) => setKind(event.target.value as FolderKind)}
        aria-label="Tipo da pasta"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        {KIND_OPTIONS.map(([value, { label }]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!name.trim()}
          className="rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          Criar pasta
        </button>
      </div>
    </form>
  );
}
