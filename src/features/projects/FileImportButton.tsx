import type { ChangeEvent, ReactNode } from "react";

interface FileImportButtonProps {
  accept: string;
  onFiles: (files: File[]) => void;
  className: string;
  children: ReactNode;
}

// Botão que abre o seletor de arquivos; vários de uma vez, cada um vira uma camada
export function FileImportButton({ accept, onFiles, className, children }: FileImportButtonProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = ""; // limpa: escolher o MESMO arquivo de novo dispara o onChange
    if (files.length > 0) onFiles(files);
  }

  return (
    <label className={`cursor-pointer ${className}`}>
      {children}
      <input type="file" multiple accept={accept} className="hidden" onChange={handleChange} />
    </label>
  );
}
