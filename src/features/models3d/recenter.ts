import { Box3, Vector3, type Object3D } from "three";

const FAR_FROM_ORIGIN_M = 10_000;

// Coordenadas UTM gravadas direto na geometria põem o objeto a milhares de km da âncora e
// perdem precisão no float32 da placa de vídeo. Traz o centro da base da caixa para a origem.
// `box` existe porque o Fragments só cria as malhas depois; ele informa a caixa à parte
export function recenterIfFar(object: Object3D, box = new Box3().setFromObject(object)): void {
  const center = box.getCenter(new Vector3());
  if (center.length() <= FAR_FROM_ORIGIN_M) return;
  object.position.sub(new Vector3(center.x, box.min.y, center.z));
}
