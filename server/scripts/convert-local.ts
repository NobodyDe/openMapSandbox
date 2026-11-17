// Converte um arquivo local sem upload, para conferir um conversor com arquivo real.
// Uso (em server/): node --env-file-if-exists=.env.local scripts/convert-local.ts <arquivo> <pastaDeSaida>
import { mkdir } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { readConfig } from "../src/config.ts";
import { converterFor } from "../src/converters/index.ts";

const [inputPath, outDir] = process.argv.slice(2);
if (!inputPath || !outDir) {
  console.error("Uso: node scripts/convert-local.ts <arquivo> <pastaDeSaida>");
  process.exit(1);
}

let lastPrinted = "";
function printProgress(progress: number | null): void {
  const text = progress === null ? "convertendo…" : `${Math.round(progress * 100)}%`;
  if (text !== lastPrinted) console.log(text); // o IFC informa milhares de vezes; só imprime quando muda
  lastPrinted = text;
}

await mkdir(outDir, { recursive: true });
const convert = converterFor(extname(inputPath).toLowerCase(), readConfig(process.env));
const started = Date.now();
const result = await convert(resolve(inputPath), resolve(outDir), printProgress, new AbortController().signal);
console.log(result, `${((Date.now() - started) / 1000).toFixed(1)} s`);
