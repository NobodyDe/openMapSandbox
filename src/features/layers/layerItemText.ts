import { FOLDER_KINDS } from "./folderKinds";
import type { FolderItem, FolderKind } from "./types";

const DESCRIPTION_KEY = "DESCRIÇÃ"; // nome truncado em 10 caracteres pelo shapefile de origem

export function itemLabel(attributes: Record<string, string>): string {
  const { ROD, km_i, km_f } = attributes;
  if (!km_i) return ROD ?? "Sem identificação";
  const km = km_f && km_f !== km_i ? `${km_i}–${km_f}` : km_i;
  return `${ROD} · km ${km}`;
}

export function itemDescription(attributes: Record<string, string>): string {
  return attributes[DESCRIPTION_KEY] ?? attributes.TIPO_OBR ?? "";
}

// As duas linhas de texto de um item na lista (também usadas pela pesquisa)
export function describeItem(kind: FolderKind, item: FolderItem): { label: string; detail: string } {
  const { itemType } = FOLDER_KINDS[kind];
  // Modelos 3D não têm atributos de KMZ: o "in" já separa os dois formatos para o TS
  if (!("attributes" in item)) return { label: item.name, detail: `${itemType} · FRAG` };
  return {
    label: itemLabel(item.attributes),
    detail: `${itemType} · ${itemDescription(item.attributes) || "KMZ"}`,
  };
}
