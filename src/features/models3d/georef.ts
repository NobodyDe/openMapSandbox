import { MercatorCoordinate } from "maplibre-gl";
import { MathUtils, Matrix4, Vector3 } from "three";
import type { Anchor, Model3dConfig } from "./models";

// IfcCompoundPlaneAngleMeasure = [graus, minutos, segundos, milionésimos de segundo], todos com o mesmo sinal
export function compoundAngleToDegrees([deg, min, sec, micro = 0]: number[]): number {
  return deg + min / 60 + (sec + micro / 1e6) / 3600;
}

export function resolveAnchor(
  config: Model3dConfig,
  site: { lng: number; lat: number } | null,
): Anchor {
  const position = config.position ?? site;
  if (!position) {
    throw new Error(`Modelo "${config.name}" sem IfcSite e sem posição manual`);
  }
  return {
    ...position,
    altitude: config.altitude ?? 0,
    bearingDeg: config.bearingDeg ?? 0,
  };
}

const EARTH_RADIUS_M = 6371008.8; // o mesmo valor que o MapLibre usa internamente

export interface ModelMatrices {
  mercator: Matrix4;
  globe: Matrix4;
}

// Metros do modelo (Y para cima) → coordenadas Mercator do MapLibre (Z para cima, Y para o sul)
function buildMercatorMatrix({ lng, lat, altitude, bearingDeg }: Anchor): Matrix4 {
  const origin = MercatorCoordinate.fromLngLat([lng, lat], altitude);
  const scale = origin.meterInMercatorCoordinateUnits();
  return new Matrix4()
    .makeTranslation(origin.x, origin.y, origin.z)
    .scale(new Vector3(scale, -scale, scale))
    .multiply(new Matrix4().makeRotationX(Math.PI / 2))
    .multiply(new Matrix4().makeRotationY(MathUtils.degToRad(-bearingDeg)));
}

// Metros do modelo → esfera de raio 1 do globo: gira até lng/lat, sobe até a superfície
// (+ altitude) e converte metros em "raios da Terra". Mesmo bearing do Mercator
function buildGlobeMatrix({ lng, lat, altitude, bearingDeg }: Anchor): Matrix4 {
  const scale = 1 / EARTH_RADIUS_M;
  return new Matrix4()
    .makeRotationY(MathUtils.degToRad(lng))
    .multiply(new Matrix4().makeRotationX(MathUtils.degToRad(-lat)))
    .multiply(new Matrix4().makeTranslation(0, 0, 1 + altitude / EARTH_RADIUS_M))
    .multiply(new Matrix4().makeRotationX(Math.PI / 2))
    .multiply(new Matrix4().makeScale(scale, scale, scale))
    .multiply(new Matrix4().makeRotationY(MathUtils.degToRad(-bearingDeg)));
}

// As duas sempre juntas: a camada escolhe qual usar a cada quadro, conforme a projeção
export function buildModelMatrices(anchor: Anchor): ModelMatrices {
  return { mercator: buildMercatorMatrix(anchor), globe: buildGlobeMatrix(anchor) };
}
