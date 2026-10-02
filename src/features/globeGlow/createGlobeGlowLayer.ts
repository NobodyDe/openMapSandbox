import type { CustomLayerInterface } from "maplibre-gl";
import {
  BackSide,
  Color,
  Mesh,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import { readGlobeCamera } from "../map/globeCamera";

const GLOW_RADIUS = 1.04; // espessura do brilho: 4% do raio da Terra (≈ 250 km)
const GLOW_COLOR = new Color("#8ec5ff"); // azul claro, combina com a atmosfera
const MAX_GLOW = 0.6; // intensidade rente à Terra (0–1)
// Valor de "facing" exatamente na borda da Terra: o degradê vai de 0 (borda de fora) até aqui
const EARTH_EDGE = Math.sqrt(1 - 1 / GLOW_RADIUS ** 2);
const SPHERE_SEGMENTS = 64; // degradê suave: não precisa da resolução da sombra

function createGlowSphere(eye: Vector3, sun: Vector3): Mesh {
  const material = new ShaderMaterial({
    uniforms: {
      uEye: { value: eye },
      uSun: { value: sun },
      uColor: { value: GLOW_COLOR },
      uEdge: { value: EARTH_EDGE },
      uMax: { value: MAX_GLOW },
    },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uEye;
      uniform vec3 uSun;
      uniform vec3 uColor;
      uniform float uEdge;
      uniform float uMax;
      varying vec3 vPos;
      void main() {
        vec3 n = normalize(vPos);
        // Faces de trás da esfera: 0 na borda externa do brilho, cresce em direção à Terra
        float facing = -dot(n, normalize(uEye - vPos));
        float glow = pow(smoothstep(0.0, uEdge, facing), 1.5); // degradê suave = "desfoque"
        float lit = smoothstep(-0.3, 0.4, dot(n, uSun));       // apaga no lado da noite
        float alpha = glow * lit * uMax;
        gl_FragColor = vec4(uColor * alpha, alpha); // cor pré-multiplicada, como o canvas espera
      }`,
    // A metade de TRÁS da esfera maior forma um disco um pouco maior que a Terra. A Terra
    // (opaca, desenhada depois) cobre o meio, e sobra só o anel entre as duas bordas
    side: BackSide,
    transparent: true,
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
  });
  const sphere = new Mesh(new SphereGeometry(GLOW_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS / 2), material);
  sphere.frustumCulled = false; // a "câmera" é só uma matriz; o culling do three erraria
  return sphere;
}

export function createGlobeGlowLayer(id: string): CustomLayerInterface {
  const camera = new PerspectiveCamera();
  const scene = new Scene();
  const eye = new Vector3();
  const sun = new Vector3();
  const sphere = createGlowSphere(eye, sun);
  scene.add(sphere);
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
      // Só com o globo "inteiro": no plano (zoom ≥ 12) não existe borda para brilhar
      if (!renderer || projectionTransition < 1) return;
      camera.projectionMatrix.fromArray(mainMatrix);
      readGlobeCamera(camera.projectionMatrix, eye, sun); // mesmo sol da atmosfera e da sombra
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
