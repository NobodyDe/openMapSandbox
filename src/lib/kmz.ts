import JSZip from "jszip";
import { kml } from "@tmcw/togeojson";
import { DOMParser } from "@xmldom/xmldom";

async function extractKmlText(kmz: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(kmz);
  const kmlEntry = Object.values(zip.files).find((f) =>
    f.name.toLowerCase().endsWith(".kml"),
  );
  if (!kmlEntry) throw new Error("KMZ não contém arquivo .kml");
  return kmlEntry.async("text");
}

function kmlTextToGeoJson(kmlText: string) {
  return kml(new DOMParser().parseFromString(kmlText, "text/xml"));
}

export async function readKmz(kmz: Blob) {
  return kmlTextToGeoJson(await extractKmlText(kmz));
}
