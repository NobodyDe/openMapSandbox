import type { CustomLayerInterface } from "maplibre-gl";
import {
  Matrix4,
  Mesh,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  Vector4,
  WebGLRenderer,
} from "three";
import { SUN_VIEW_DIRECTION } from "../map/atmosphere";

const MAX_DARKNESS = 0.8; // 1 = noite totalmente preta
// O globo tem raio 1 no espaço do MapLibre. A esfera fica só um fio acima (≈ 640 m) e bem
// subdividida: os polígonos não afundam na Terra e, com a câmera inclinada, a sombra não
// "vaza" como uma faixa escura acima do horizonte
const SHADOW_SPHERE_RADIUS = 1.0001;
const SPHERE_SEGMENTS = 256;

function createShadowSphere(sunDirection: Vector3): Mesh {
  const material = new ShaderMaterial({
    uniforms: {
      uSunDirection: { value: sunDirection },
      uMaxDarkness: { value: MAX_DARKNESS },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      void main() {
        vNormal = position; // esfera centrada na origem: a posição já aponta para fora
        gl_Position = projectionMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDirection;
      uniform float uMaxDarkness;
      varying vec3 vNormal;
      void main() {
        // 1 = sol a pino, 0 = linha do dia/noite, negativo = noite
        float light = dot(normalize(vNormal), uSunDirection);
        // Crepúsculo: começa a escurecer com o sol baixo (0.25) e é noite plena logo depois
        // da linha do dia/noite (-0.15). Faixa suave, não um corte seco
        float night = 1.0 - smoothstep(-0.15, 0.25, light);
        float alpha = night * uMaxDarkness;
        gl_FragColor = vec4(0.0, 0.0, 0.0, alpha); // preto: a cor pré-multiplicada é 0
      }`,
    transparent: true,
    premultipliedAlpha: true,
    // Sem teste de profundidade: o three já descarta as faces de costas (FrontSide, o padrão),
    // então só a metade voltada para a câmera é desenhada, nunca a de trás "através" do globo
    depthTest: false,
    depthWrite: false,
  });
  const sphere = new Mesh(new SphereGeometry(SHADOW_SPHERE_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS / 2), material);
  sphere.frustumCulled = false; // a "câmera" é só uma matriz; o culling do three erraria
  return sphere;
}

export function createGlobeShadowLayer(id: string): CustomLayerInterface {
  const camera = new PerspectiveCamera();
  const scene = new Scene();
  const sunDirection = new Vector3();
  const sphere = createShadowSphere(sunDirection);
  scene.add(sphere);
  const inverse = new Matrix4();
  const eye = new Vector4();
  const center = new Vector3();
  const right = new Vector3();
  const up = new Vector3();
  const toViewer = new Vector3();
  const [sunX, sunY, sunZ] = SUN_VIEW_DIRECTION;
  let renderer: WebGLRenderer | null = null;

  // O sol é definido em relação à tela (direita, cima, em direção a quem olha). Para usar no
  // globo, monta esses três eixos no espaço do globo "desprojetando" pontos da tela
  const updateSunDirection = () => {
    inverse.copy(camera.projectionMatrix).invert();
    eye.set(0, 0, 1, 0).applyMatrix4(inverse); // posição da câmera: o ponto que a matriz leva para w = 0
    center.set(0, 0, 0).applyMatrix4(inverse); // centro da tela
    right.set(1, 0, 0).applyMatrix4(inverse).sub(center).normalize(); // borda direita da tela
    up.set(0, 1, 0).applyMatrix4(inverse).sub(center).normalize(); // borda de cima da tela
    toViewer.set(eye.x / eye.w, eye.y / eye.w, eye.z / eye.w).sub(center).normalize();
    sunDirection
      .set(0, 0, 0)
      .addScaledVector(right, sunX)
      .addScaledVector(up, sunY)
      .addScaledVector(toViewer, sunZ)
      .normalize();
  };

  // closures, não `this`: o <Layer> do react-map-gl repassa uma CÓPIA do objeto
  return {
    id,
    type: "custom",
    renderingMode: "3d",
    onAdd(map, gl) {
      renderer = new WebGLRenderer({ canvas: map.getCanvas(), context: gl });
      renderer.autoClear = false;
    },
    render(_gl, { defaultProjectionData: { mainMatrix, projectionTransition } }) {
      // Só com o globo "inteiro": na transição para o plano (zoom 11–12) a esfera não casaria com o mapa
      if (!renderer || projectionTransition < 1) return;
      camera.projectionMatrix.fromArray(mainMatrix);
      updateSunDirection(); // a câmera mudou: o sol, preso a ela, também
      renderer.resetState();
      renderer.render(scene, camera);
    },
    onRemove() {
      // libera a GPU; se a camada for readicionada (StrictMode), o three reenvia sozinho
      sphere.geometry.dispose();
      (sphere.material as ShaderMaterial).dispose();
      renderer?.dispose();
    },
  };
}
