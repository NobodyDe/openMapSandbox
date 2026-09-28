import { useState, type ChangeEvent } from "react";
import { importTrechosKmz } from "./importTrechosKmz";
import type { Trecho } from "./types";

interface KmzTrechosInputProps {
  onLoad: (trechos: Trecho[]) => void;
}

export function KmzTrechosInput({ onLoad }: KmzTrechosInputProps) {
  const [loading, setLoading] = useState(false);

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      onLoad(await importTrechosKmz(file));
    } catch (error) {
      alert(`Não foi possível ler o KMZ: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <label
      className={`cursor-pointer rounded bg-white px-3 py-2 text-sm shadow ${loading ? "pointer-events-none opacity-60" : ""}`}
    >
      {loading ? "Importando trechos…" : "Importar trechos (KMZ)"}
      <input
        type="file"
        accept=".kmz"
        className="hidden"
        disabled={loading}
        onChange={handleChange}
      />
    </label>
  );
}
