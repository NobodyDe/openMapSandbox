import { useState, type ChangeEvent, type ReactNode } from "react";

interface FileImportButtonProps {
  accept: string;
  onFile: (file: File) => Promise<void>;
  className: string;
  children: ReactNode;
}

// Botão que abre o seletor de arquivo e mostra "Importando…" até o arquivo ser lido
export function FileImportButton({ accept, onFile, className, children }: FileImportButtonProps) {
  const [busy, setBusy] = useState(false);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // limpa: escolher o MESMO arquivo de novo dispara o onChange
    if (!file) return;
    setBusy(true);
    try {
      await onFile(file);
    } catch (error) {
      alert(`Não foi possível importar: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className={`cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""} ${className}`}>
      {busy ? <span className="text-sm">Importando…</span> : children}
      <input type="file" accept={accept} className="hidden" disabled={busy} onChange={handleChange} />
    </label>
  );
}
