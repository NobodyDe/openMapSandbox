import { open } from "node:fs/promises";

// Início obrigatório de cada formato aceito. As chaves são também a lista de extensões aceitas
export const SIGNATURES: Record<string, string> = {
  ".las": "LASF",
  ".laz": "LASF",
  ".glb": "glTF",
  ".ifc": "ISO-10303-21",
};

// Evita mandar ao conversor um arquivo renomeado: o erro dele seria bem menos claro
export async function hasValidSignature(path: string, ext: string): Promise<boolean> {
  const signature = SIGNATURES[ext];
  const file = await open(path);
  try {
    const { buffer, bytesRead } = await file.read(Buffer.alloc(signature.length), 0, signature.length, 0);
    return buffer.toString("latin1", 0, bytesRead) === signature;
  } finally {
    await file.close();
  }
}
