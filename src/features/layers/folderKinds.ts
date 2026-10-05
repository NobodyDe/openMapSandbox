import { Box, MapPin, Spline, type LucideIcon } from "lucide-react";
import type { FolderKind } from "./types";

interface FolderKindInfo {
  label: string; // nome do tipo no seletor de "Nova pasta" e no menu "Adicionar camada"
  itemType: string; // aparece na linha de cada item: "Linha · …"
  accept: string; // extensões aceitas no seletor de arquivo
  importLabel: string;
  icon: LucideIcon;
}

// Tudo o que muda de um tipo de pasta para outro, num lugar só
export const FOLDER_KINDS: Record<FolderKind, FolderKindInfo> = {
  trechos: { label: "Trechos", itemType: "Linha", accept: ".kmz", importLabel: "Importar KMZ", icon: Spline },
  points: { label: "Pontos", itemType: "Ponto", accept: ".kmz", importLabel: "Importar KMZ", icon: MapPin },
  models: { label: "Modelos 3D", itemType: "Modelo 3D", accept: ".frag", importLabel: "Importar modelo 3D", icon: Box },
};
