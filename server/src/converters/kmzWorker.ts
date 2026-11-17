import { readFile, writeFile } from "node:fs/promises";
import { parentPort, workerData } from "node:worker_threads";
import { bbox } from "@turf/turf";
import { kml } from "@tmcw/togeojson";
import { DOMParser } from "@xmldom/xmldom";
import type { FeatureCollection } from "geojson";
import JSZip from "jszip";
import type { LngLat } from "../jobs/types.ts";
import { kmlToFeatures } from "../georef/kml.ts";

const { inputPath, outputPath } = workerData as { inputPath: string; outputPath: string };

async function extractKmlText(kmzPath: string): Promise<string> {
  const zip = await JSZip.loadAsync(await readFile(kmzPath));
  const kmlEntry = Object.values(zip.files).find((file) => file.name.toLowerCase().endsWith(".kml"));
  if (!kmlEntry) throw new Error("O KMZ não contém arquivo .kml.");
  return kmlEntry.async("text");
}

// Centro da caixa de todas as feições; sem feições não há centro
function centerOf(collection: FeatureCollection): LngLat | null {
  if (collection.features.length === 0) return null;
  const [west, south, east, north] = bbox(collection);
  return { lng: (west + east) / 2, lat: (south + north) / 2 };
}

const document = new DOMParser().parseFromString(await extractKmlText(inputPath), "text/xml");
// cast: o togeojson tipa o Document do navegador; o do xmldom tem o que ele usa
const collection: FeatureCollection = {
  type: "FeatureCollection",
  features: kmlToFeatures(kml(document as unknown as Parameters<typeof kml>[0])),
};
await writeFile(outputPath, JSON.stringify(collection));
parentPort?.postMessage({ center: centerOf(collection) });
