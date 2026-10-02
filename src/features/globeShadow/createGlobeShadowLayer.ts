import type { CustomLayerInterface } from "maplibre-gl";
import {
  Mesh,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import { readGlobeCamera } from "../map/globeCamera";

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
  const eye = new Vector3(); // a sombra só precisa do sol, mas a leitura devolve os dois
  let renderer: WebGLRenderer | null = null;

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
      readGlobeCamera(camera.projectionMatrix, eye, sunDirection); // o sol, preso à câmera, muda com ela
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
