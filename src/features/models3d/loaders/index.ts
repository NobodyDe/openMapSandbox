import type { ModelFormat } from "../models";
import { loadFrag } from "./loadFrag";
import { loadGlb } from "./loadGlb";
import { loadPointCloud } from "./loadPointCloud";
import type { Loader } from "./types";

export const LOADERS: Record<ModelFormat, Loader> = {
  frag: loadFrag,
  glb: loadGlb,
  pointcloud: loadPointCloud,
};
