import type { GeoJsonProperties } from "geojson";

// Chaves que o togeojson gera a partir do <Style> e do cabeçalho do <Placemark>
const KML_META_KEYS = new Set([
  "name",
  "description",
  "styleUrl",
  "stroke",
  "stroke-opacity",
  "stroke-width",
  "fill",
  "fill-opacity",
  "icon",
  "icon-color",
  "icon-opacity",
  "icon-scale",
  "icon-heading",
]);
// Como cada exportação escreve "sem valor": "_" nos pontos, "-" nos trechos
const EMPTY_VALUES = new Set(["", "_", "-"]);

export function extractAttributes(
  properties: GeoJsonProperties,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(properties ?? {})
      .filter(
        ([key, value]) =>
          !KML_META_KEYS.has(key) && !EMPTY_VALUES.has(String(value)),
      )
      .map(([key, value]) => [key, String(value)]),
  );
}
