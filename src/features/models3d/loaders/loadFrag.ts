import { getFragmentsEngine } from "../fragmentsEngine";
import { hideIfcTerrain } from "../hideIfcTerrain";
import { readIfcSiteLocation } from "../ifcSite";
import { recenterIfFar } from "../recenter";
import type { Loader } from "./types";

export const loadFrag: Loader = async (config, signal) => {
  const engine = getFragmentsEngine();
  const modelId = `${config.id}-${crypto.randomUUID()}`; // único por montagem: o StrictMode monta 2× em dev
  const buffer = await fetch(config.url, { signal }).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.arrayBuffer();
  });
  const model = await engine.load(buffer, { modelId });
  const site = await readIfcSiteLocation(model);
  await hideIfcTerrain(model); // antes de a camada existir: a base nunca chega a aparecer
  recenterIfFar(model.object, model.box);
  return {
    object: model.object,
    site,
    update: () => void engine.update(), // o Fragments carrega/descarrega tiles do modelo
    dispose: () => engine.disposeModel(modelId),
  };
};
