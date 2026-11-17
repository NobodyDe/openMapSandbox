import { readSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parentPort, workerData } from "node:worker_threads";
import { IfcImporter } from "@thatopen/fragments";

const { fd, outputPath } = workerData as { fd: number; outputPath: string };

// O .wasm do web-ifc fica na pasta do próprio pacote; o IfcImporter espera a barra no fim
function webIfcDir(): string {
  return dirname(fileURLToPath(import.meta.resolve("web-ifc"))) + sep;
}

// O web-ifc pede o arquivo aos pedaços: um IFC de centenas de MB nunca fica inteiro na memória
function readPart(offset: number, size: number): Uint8Array {
  const buffer = new Uint8Array(size);
  const bytesRead = readSync(fd, buffer, 0, size, offset);
  return buffer.subarray(0, bytesRead);
}

const importer = new IfcImporter();
importer.wasm = { path: webIfcDir(), absolute: true };
const fragments = await importer.process({
  readFromCallback: true,
  readCallback: readPart,
  progressCallback: (progress) => parentPort?.postMessage(progress),
});
await writeFile(outputPath, fragments);
