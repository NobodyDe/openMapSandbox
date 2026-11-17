import { Vector3, Vector4, type Matrix4, type PerspectiveCamera } from "three";

// A câmera que desenha carrega a matriz inteira do mapa na projeção e fica na origem.
// Para escolher o nível de detalhe é preciso a posição real do olho, em metros do modelo.
export function updateLodCamera(lodCamera: PerspectiveCamera, mvp: Matrix4, fovDeg: number, aspect: number): void {
  const inverse = mvp.clone().invert();
  const eye4 = new Vector4(0, 0, 1, 0).applyMatrix4(inverse); // o olho é o ponto que a projeção leva a w = 0
  const eye = new Vector3(eye4.x / eye4.w, eye4.y / eye4.w, eye4.z / eye4.w);
  const near = new Vector3(0, 0, -1).applyMatrix4(inverse); // centro da tela, no plano próximo
  const target = new Vector3(0, 0, 1).applyMatrix4(inverse); // centro da tela, no plano distante
  lodCamera.position.copy(eye);
  lodCamera.up.copy(new Vector3(0, 1, 1).applyMatrix4(inverse).sub(target).normalize());
  lodCamera.lookAt(target);
  lodCamera.fov = fovDeg;
  lodCamera.aspect = aspect;
  // Mesmos planos do mapa: a nuvem não descarta pedaços que o mapa ainda desenha
  lodCamera.near = eye.distanceTo(near);
  lodCamera.far = eye.distanceTo(target);
  lodCamera.updateProjectionMatrix();
  lodCamera.updateMatrixWorld();
}
