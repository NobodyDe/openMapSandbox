import type { CustomLayerInterface } from "maplibre-gl";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from "three";

const STAR_COUNT = 9000;
// Tons pastel: branco, amarelo e roxo suaves (cores fortes parecem "pontos de tinta", não estrelas)
const STAR_COLORS = [
  new Color("#ffffff"),
  new Color("#fff1c4"),
  new Color("#d9ccff"),
];
// O ponto é desenhado 4× maior para caber o halo; o núcleo continua com 1–2,5 px
const GLOW_SCALE = 4;

// Direção aleatória uniforme na esfera: cada estrela é um ponto "no infinito"
function randomDirection(): Vector3 {
  const z = Math.random() * 2 - 1;
  const angle = Math.random() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return new Vector3(r * Math.cos(angle), r * Math.sin(angle), z);
}

function createStars(): Points {
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const sizes = new Float32Array(STAR_COUNT);
  for (let i = 0; i < STAR_COUNT; i++) {
    randomDirection().toArray(positions, i * 3);
    const brightness = 0.4 + Math.random() * 0.6;
    STAR_COLORS[i % STAR_COLORS.length]
      .clone()
      .multiplyScalar(brightness)
      .toArray(colors, i * 3);
    sizes[i] = (1 + Math.random() * 1.5) * GLOW_SCALE * devicePixelRatio;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));

  const material = new ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      varying vec3 vColor;
      void main() {
        vColor = aColor;
        // w = 0: é uma DIREÇÃO, então a translação da câmera não afeta, só a rotação.
        // Zoom não move as estrelas; girar o globo sim (igual a um céu real)
        gl_Position = projectionMatrix * vec4(position, 0.0);
        gl_Position.z = gl_Position.w; // no plano mais distante: nunca é cortada pelo far plane
        gl_PointSize = aSize;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0; // 0 no centro, 1 na borda do ponto
        if (d > 1.0) discard;
        float core = 1.0 - smoothstep(0.1, 0.25, d); // núcleo nítido (~1/GLOW_SCALE do ponto)
        float glow = pow(1.0 - d, 3.0) * 0.35;        // halo fraco que some até a borda
        float alpha = min(core + glow, 1.0);
        gl_FragColor = vec4(vColor * alpha, alpha); // cor pré-multiplicada, como o canvas do mapa espera
      }`,
    transparent: true, // o halo mistura com o fundo em vez de pintar um quadrado
    premultipliedAlpha: true,
    depthTest: false, // fica na base da pilha: o globo e a atmosfera pintam por cima
    depthWrite: false,
  });

  const stars = new Points(geometry, material);
  stars.frustumCulled = false; // a "câmera" é só uma matriz; o culling do three erraria
  return stars;
}

export function createStarsLayer(id: string): CustomLayerInterface {
  const camera = new PerspectiveCamera();
  const scene = new Scene();
  const stars = createStars();
  scene.add(stars);
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
    render(
      _gl,
      { defaultProjectionData: { mainMatrix, projectionTransition } },
    ) {
      if (!renderer || projectionTransition === 0) return; // plano: o fundo nunca aparece
      camera.projectionMatrix.fromArray(mainMatrix);
      renderer.resetState();
      renderer.render(scene, camera);
    },
    onRemove() {
      // libera a GPU; se a camada for readicionada (StrictMode), o three reenvia sozinho
      stars.geometry.dispose();
      (stars.material as ShaderMaterial).dispose();
      renderer?.dispose();
    },
  };
}
