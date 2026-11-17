import test from "node:test";
import assert from "node:assert/strict";
import { epsgToProj4, gridNorthBearing, projectedToLngLat } from "../src/georef/crs.ts";

const near = (actual: number, expected: number, tolerance: number) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} longe de ${expected}`);

test("meridiano central no equador", () => {
  const wgs = projectedToLngLat(epsgToProj4(32722)!, 500000, 10000000);   // UTM 22S
  near(wgs.lng, -51, 1e-6); near(wgs.lat, 0, 1e-6);
  const sirgas = projectedToLngLat(epsgToProj4(31983)!, 500000, 10000000); // SIRGAS 2000 / UTM 23S
  near(sirgas.lng, -45, 1e-6); near(sirgas.lat, 0, 1e-6);
});

test("centro da nuvem real BASE_AP0_5cm_1.las", () => {
  const { lng, lat } = projectedToLngLat(epsgToProj4(32722)!, 752592.66, 7260597.4);
  near(lng, -48.5, 0.1); near(lat, -24.75, 0.05);
});

test("norte da grade", () => {
  const crs = epsgToProj4(32722)!;
  near(gridNorthBearing(crs, 500000, 7260597.4), 0, 1e-6);      // no meridiano central não há desvio
  near(gridNorthBearing(crs, 752592.66, 7260597.4), -1.05, 0.15); // a leste, no hemisfério sul: grade a oeste do norte
});

test("EPSG fora da lista", () => assert.equal(epsgToProj4(4326), null));
