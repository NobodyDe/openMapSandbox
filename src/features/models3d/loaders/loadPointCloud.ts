import { PointSizeType, Potree, type PointCloudOctree } from "potree-core";
import { Group, Vector3 } from "three";
import type { Loader } from "./types";

// Teto de pontos desenhados: acima disso o mapa perde fluidez em placa de vídeo integrada
const POINT_BUDGET = 2_000_000;
const POINT_SIZE_PX = 2;

// Ponto do arquivo que vira a origem local: o do cabeçalho LAS ou, sem ele, o centro da caixa no chão
function cloudOrigin(cloud: PointCloudOctree, localOrigin?: [number, number, number]): Vector3 {
  if (localOrigin) return new Vector3(...localOrigin);
  const box = cloud.boundingBox.clone().translate(cloud.position); // em coordenadas do arquivo
  const center = box.getCenter(new Vector3());
  return new Vector3(center.x, center.y, box.min.z);
}

// O potree-core lê só os pedaços do octree que a câmera vê, por requisições Range
export const loadPointCloud: Loader = async (config) => {
  const potree = new Potree();
  potree.pointBudget = POINT_BUDGET;
  const baseUrl = config.url.slice(0, config.url.lastIndexOf("/") + 1); // os 3 arquivos ficam na mesma pasta
  const cloud = await potree.loadPointCloud(config.url.slice(baseUrl.length), baseUrl);
  cloud.material.size = POINT_SIZE_PX;
  cloud.material.pointSizeType = PointSizeType.FIXED;
  // A nuvem vem em coordenadas do arquivo (UTM): desloca para perto da origem, sem perder precisão
  cloud.position.sub(cloudOrigin(cloud, config.localOrigin));
  const group = new Group();
  group.rotation.x = -Math.PI / 2; // LAS tem Z para cima; as matrizes do mapa esperam Y para cima e −Z = norte
  group.add(cloud);
  return {
    object: group,
    update: (lodCamera, renderer) => void potree.updatePointClouds([cloud], lodCamera, renderer),
    dispose: () => cloud.dispose(),
  };
};
