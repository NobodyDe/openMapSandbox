import { Matrix4, Vector3, Vector4 } from "three";
import { SUN_VIEW_DIRECTION } from "./atmosphere";

// Rascunhos reaproveitados a cada quadro (nada é alocado durante o render)
const inverse = new Matrix4();
const eye4 = new Vector4();
const center = new Vector3();
const right = new Vector3();
const up = new Vector3();
const toViewer = new Vector3();

// Lê da matriz do MapLibre a posição da câmera e a direção do sol, no espaço do globo
// (Terra = esfera de raio 1). Usado pelas camadas de sombra e de brilho, para que as
// duas (e a atmosfera) vejam exatamente o mesmo sol
export function readGlobeCamera(matrix: Matrix4, eye: Vector3, sun: Vector3) {
  inverse.copy(matrix).invert();
  eye4.set(0, 0, 1, 0).applyMatrix4(inverse); // a câmera é o ponto que a matriz leva para w = 0
  eye.set(eye4.x / eye4.w, eye4.y / eye4.w, eye4.z / eye4.w);
  // O sol é definido em relação à tela (direita, cima, em direção a quem olha): monta esses
  // três eixos no espaço do globo "desprojetando" pontos da tela
  center.set(0, 0, 0).applyMatrix4(inverse); // centro da tela
  right.set(1, 0, 0).applyMatrix4(inverse).sub(center).normalize(); // borda direita
  up.set(0, 1, 0).applyMatrix4(inverse).sub(center).normalize(); // borda de cima
  toViewer.copy(eye).sub(center).normalize();
  const [x, y, z] = SUN_VIEW_DIRECTION;
  sun.set(0, 0, 0).addScaledVector(right, x).addScaledVector(up, y).addScaledVector(toViewer, z).normalize();
}
