import type { LightSpecification, SkySpecification } from "react-map-gl/maplibre";

// Base no exemplo oficial do MapLibre (some entre o zoom 5 e o 7, quando o globo já
// ocupa a tela), com intensidade 0.5: com o sol vindo da câmera, 1 deixa a Terra "lavada"
const ATMOSPHERE_ON: SkySpecification = {
  "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.5, 5, 0.5, 7, 0],
};
// Desligar = zerar explicitamente: o react-map-gl ignora sky={undefined},
// e a atmosfera continuaria na tela
const ATMOSPHERE_OFF: SkySpecification = { "atmosphere-blend": 0 };

// O SOL, preso à câmera (a parte iluminada acompanha a visualização). Ele vem de trás de
// quem olha, inclinado SUN_OFFSET_DEG para o lado SUN_FROM_DEG da tela: quase todo o globo
// visível fica de dia, e a noite aparece na borda oposta. Atmosfera e sombra usam este mesmo sol
const SUN_OFFSET_DEG = 55; // 0 = exatamente atrás da câmera (a noite fica toda escondida)
const SUN_FROM_DEG = 135; // na tela: 0 = direita, 90 = cima, 135 = canto superior esquerdo

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

// x = direita da tela, y = cima, z = para fora da tela (em direção a quem olha)
export const SUN_VIEW_DIRECTION: [number, number, number] = [
  Math.sin(toRad(SUN_OFFSET_DEG)) * Math.cos(toRad(SUN_FROM_DEG)),
  Math.sin(toRad(SUN_OFFSET_DEG)) * Math.sin(toRad(SUN_FROM_DEG)),
  Math.cos(toRad(SUN_OFFSET_DEG)),
];

// A luz do MapLibre usa [raio, azimute, polar], e a atmosfera pega o OPOSTO dessa posição
// como sol (por isso o sinal trocado). O azimute tem um giro de 90° na conversão interna
function lightPositionFor([x, y, z]: [number, number, number]): [number, number, number] {
  const polar = toDeg(Math.acos(-z));
  const azimuth = (toDeg(Math.atan2(-y, -x)) - 90 + 360) % 360;
  return [1.5, azimuth, polar];
}

const SUN_LIGHT: LightSpecification = {
  anchor: "viewport", // preso à câmera, não ao globo
  position: lightPositionFor(SUN_VIEW_DIRECTION),
};
// Padrão do MapLibre, devolvido explicitamente (light={undefined} é ignorado pelo react-map-gl).
// Sem satélite os prédios 3D aparecem, e precisam da luz normal de cima
const DEFAULT_LIGHT: LightSpecification = { anchor: "viewport", position: [1.15, 210, 30] };

export function atmosphereSky(enabled: boolean): SkySpecification {
  return enabled ? ATMOSPHERE_ON : ATMOSPHERE_OFF;
}

export function atmosphereLight(enabled: boolean): LightSpecification {
  return enabled ? SUN_LIGHT : DEFAULT_LIGHT;
}
