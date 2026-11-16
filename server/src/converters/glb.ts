import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, textureCompress } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";
import type { Converter } from "./index.ts";

// O navegador carrega o GLB inteiro de uma vez; acima disso a aba fica sem memória
const MAX_OUTPUT_BYTES = 1024 ** 3;

async function createIO(): Promise<NodeIO> {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
}

// Remove duplicados e sobras, comprime a geometria (meshopt) e limita texturas a 2048 px
export const convertGlb: Converter = async (inputPath, outDir, onProgress) => {
  onProgress(null);
  const io = await createIO();
  const document = await io.read(inputPath);
  await document.transform(
    dedup(),
    prune(),
    textureCompress({ encoder: sharp, resize: [2048, 2048] }),
    meshopt({ encoder: MeshoptEncoder }),
  );
  const bytes = await io.writeBinary(document);
  if (bytes.byteLength > MAX_OUTPUT_BYTES) {
    throw new Error("O GLB continua acima de 1 GB depois de comprimido e não cabe no navegador.");
  }
  await writeFile(join(outDir, "model.glb"), bytes);
  return { format: "glb", file: "model.glb" };
};
