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
