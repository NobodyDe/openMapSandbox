import type { CustomLayerInterface, Map as MapLibreMap } from "maplibre-gl";
import type { FragmentsModel } from "@thatopen/fragments";
import {
  AmbientLight,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { getFragmentsEngine } from "./fragmentsEngine";
import type { ModelMatrices } from "./georef";

export function createFragmentsLayer(
  id: string,
  model: FragmentsModel,
  matrices: ModelMatrices,
): CustomLayerInterface {
  const camera = new PerspectiveCamera(); // a matriz de projeção é substituída a cada frame
  const scene = new Scene();
  const sun = new DirectionalLight(0xffffff, 2);
  sun.position.set(50, 100, 50);
  scene.add(new AmbientLight(0xffffff, 1.2), sun);

  let map: MapLibreMap | null = null;
  let renderer: WebGLRenderer | null = null;

  // closures, não `this`: o <Layer> do react-map-gl repassa uma CÓPIA do objeto
  return {
    id,
    type: "custom",
    renderingMode: "3d", // compartilha o depth buffer do mapa
    // onAdd/onRemove simétricos: o MapLibre pode remover e readicionar a mesma camada
    // (o StrictMode faz isso em dev), então o modelo entra na cena a cada onAdd
    onAdd(m, gl) {
      map = m;
      scene.add(model.object);
      renderer = new WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false; // não apagar o que o MapLibre já desenhou
    },
    render(_gl, args) {
      if (!renderer || !map) return;
      const { projectionTransition, mainMatrix } = args.defaultProjectionData;
      // 1 = globo, 0 = Mercator. Mesmo com o globo ativo, o MapLibre volta ao Mercator
      // a partir do zoom ~12, então a escolha é feita a cada quadro
      const modelMatrix = projectionTransition > 0 ? matrices.globe : matrices.mercator;
      camera.projectionMatrix.fromArray(mainMatrix).multiply(modelMatrix);
      renderer.resetState(); // MapLibre e three dividem o mesmo estado WebGL
      renderer.render(scene, camera);
      void getFragmentsEngine().update(); // o Fragments carrega/descarrega tiles do modelo
      map.triggerRepaint();
    },
    onRemove() {
      scene.remove(model.object);
      renderer?.dispose();
    },
  };
}
