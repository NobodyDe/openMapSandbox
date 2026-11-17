import { createReadStream } from "node:fs";
import type { LngLat } from "../jobs/types.ts";

const SITE_MARKER = "IFCSITE(";
// IfcSite(GlobalId, OwnerHistory, Name, Description, ObjectType, ObjectPlacement, Representation,
// LongName, CompositionType, RefLatitude, RefLongitude, …): latitude e longitude são o 10º e o 11º
const LATITUDE_ARG = 9;
const LONGITUDE_ARG = 10;

// IfcCompoundPlaneAngleMeasure = [graus, minutos, segundos, milionésimos de segundo], todos com o mesmo sinal.
// Cópia da regra do frontend (models3d/georef.ts), que ainda lê o IfcSite do .frag local
function compoundAngleToDegrees([deg, min, sec, micro = 0]: number[]): number {
  return deg + min / 60 + (sec + micro / 1e6) / 3600;
}

// Argumentos do nível de cima até o ")" que fecha a entidade. Vírgulas dentro de listas "(…)"
// e de textos '…' não separam. null = a entidade continua no próximo pedaço do arquivo
function splitArguments(body: string): string[] | null {
  const args: string[] = [];
  let current = "";
  let depth = 0;
  let inText = false;
  for (const char of body) {
    if (char === "'") inText = !inText; // '' (aspas escapadas) troca duas vezes e volta ao certo
    if (!inText && char === ")" && depth === 0) return [...args, current];
    if (!inText && char === "," && depth === 0) {
      args.push(current);
      current = "";
      continue;
    }
    if (!inText && char === "(") depth++;
    if (!inText && char === ")") depth--;
    current += char;
  }
  return null;
}

// "(22,54,10,123)" → [22, 54, 10, 123]; "$" (sem valor) → null
function parseCompoundAngle(arg: string | undefined): number[] | null {
  const text = arg?.trim();
  if (!text?.startsWith("(")) return null;
  return text.slice(1, -1).split(",").map(Number);
}

function siteLocation(args: string[]): LngLat | null {
  const lat = parseCompoundAngle(args[LATITUDE_ARG]);
  const lng = parseCompoundAngle(args[LONGITUDE_ARG]);
  return lat && lng ? { lat: compoundAngleToDegrees(lat), lng: compoundAngleToDegrees(lng) } : null;
}

// Lê o texto do IFC em pedaços até a entidade IFCSITE: o arquivo pode ter centenas de MB
export async function readIfcSite(path: string): Promise<LngLat | null> {
  let text = "";
  for await (const chunk of createReadStream(path, { encoding: "latin1" })) {
    text += chunk;
    const start = text.indexOf(SITE_MARKER);
    if (start < 0) {
      text = text.slice(-SITE_MARKER.length); // o marcador pode estar cortado entre dois pedaços
      continue;
    }
    const args = splitArguments(text.slice(start + SITE_MARKER.length));
    if (args) return siteLocation(args);
    text = text.slice(start);
  }
  return null;
}
