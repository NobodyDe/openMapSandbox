import type { CustomLayerInterface, Map as MapLibreMap } from "maplibre-gl";
import {
  AmbientLight,
  DirectionalLight,
  Matrix4,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import type { ModelMatrices } from "./georef";
import { updateLodCamera } from "./lodCamera";
import type { LoadedModel } from "./loaders/types";

export function createThreeLayer(
  id: string,
  loaded: LoadedModel,
  matrices: ModelMatrices,
): CustomLayerInterface {
  const camera = new PerspectiveCamera(); // a matriz de projeção é substituída a cada frame
  const lodCamera = new PerspectiveCamera(); // só para o nível de detalhe (lodCamera.ts)
  const mvp = new Matrix4();
  const scene = new Scene();
  const sun = new DirectionalLight(0xffffff, 2);
  sun.position.set(50, 100, 50);
  scene.add(new AmbientLight(0xffffff, 1.2), sun);

  let map: MapLibreMap | null = null;
  let renderer: WebGLRenderer | null = null;

  // O three guarda o tamanho do canvas de quando foi criado. Se o mapa muda de tamanho (janela,
  // DevTools), o modelo seria desenhado num pedaço da tela, longe do lugar certo
  function syncRendererSize() {
    if (!renderer || !map) return;
    const canvas = map.getCanvas();
    renderer.setSize(canvas.width, canvas.height, false); // no evento "resize": o quadro ainda vai ser redesenhado
  }

  // closures, não `this`: o <Layer> do react-map-gl repassa uma CÓPIA do objeto
  return {
    id,
    type: "custom",
    renderingMode: "3d", // compartilha o depth buffer do mapa
    // onAdd/onRemove simétricos: o MapLibre pode remover e readicionar a mesma camada
    // (o StrictMode faz isso em dev), então o modelo entra na cena a cada onAdd
    onAdd(m, gl) {
      map = m;
      scene.add(loaded.object);
      renderer = new WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false; // não apagar o que o MapLibre já desenhou
      m.on("resize", syncRendererSize);
    },
    render(_gl, args) {
      if (!renderer || !map) return;
      const { projectionTransition, mainMatrix } = args.defaultProjectionData;
      // 1 = globo, 0 = Mercator. Mesmo com o globo ativo, o MapLibre volta ao Mercator
      // a partir do zoom ~12, então a escolha é feita a cada quadro
      const modelMatrix = projectionTransition > 0 ? matrices.globe : matrices.mercator;
      mvp.fromArray(mainMatrix).multiply(modelMatrix);
      camera.projectionMatrix.copy(mvp);
      renderer.resetState(); // MapLibre e three dividem o mesmo estado WebGL
      renderer.render(scene, camera);
      if (loaded.update) {
        const canvas = map.getCanvas();
        updateLodCamera(lodCamera, mvp, map.getVerticalFieldOfView(), canvas.width / canvas.height);
        loaded.update(lodCamera, renderer);
      }
      map.triggerRepaint();
    },
    onRemove() {
      map?.off("resize", syncRendererSize);
      scene.remove(loaded.object);
      renderer?.dispose();
    },
  };
}
