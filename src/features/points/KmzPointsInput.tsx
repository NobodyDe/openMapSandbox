import type { ChangeEvent } from "react";
import { readKmz } from "../../lib/kmz";
import { featuresToPoints } from "./kmzToPoints";
import type { MapPoint } from "./types";

interface KmzPointsInputProps {
  onLoad: (points: MapPoint[]) => void;
}

export function KmzPointsInput({ onLoad }: KmzPointsInputProps) {
  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      onLoad(featuresToPoints(await readKmz(file)));
    } catch (error) {
      alert(`Não foi possível ler o KMZ: ${(error as Error).message}`);
    }
  }

  return (
    <label className="cursor-pointer rounded bg-white px-3 py-2 text-sm shadow">
      Importar KMZ
      <input
        type="file"
        accept=".kmz"
        className="hidden"
        onChange={handleChange}
      />
    </label>
  );
}
