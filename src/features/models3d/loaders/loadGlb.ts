import { Texture, type Material, type Mesh, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { recenterIfFar } from "../recenter";
import type { Loader } from "./types";

function disposeMaterial(material: Material): void {
  for (const value of Object.values(material)) if (value instanceof Texture) value.dispose();
  material.dispose();
}

// O GLB vira geometrias, materiais e texturas na placa de vídeo; sem isto ficariam lá depois de ocultar
function disposeObject(object: Object3D): void {
  object.traverse((child) => {
    if (!("geometry" in child)) return;
    const { geometry, material } = child as Mesh;
    geometry.dispose();
    [material].flat().forEach(disposeMaterial);
  });
}

export const loadGlb: Loader = async (config, signal) => {
  const buffer = await fetch(config.url, { signal }).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.arrayBuffer();
  });
  // O servidor comprime a geometria com meshopt; sem o decodificador o GLB não abre
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer, "");
  recenterIfFar(gltf.scene);
  return { object: gltf.scene, dispose: () => disposeObject(gltf.scene) };
};
