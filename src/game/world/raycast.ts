import { isTargetable } from "./blocks";
import type { World } from "./World";

export interface RayHit {
  x: number; y: number; z: number;
  /** The empty cell just before the hit: where a new block would be placed. */
  px: number; py: number; pz: number;
}

interface Vec3Like { x: number; y: number; z: number }

/** Walk the grid cell by cell along a ray (Amanatides & Woo) until a targetable block. */
export function raycast(world: World, o: Vec3Like, dir: Vec3Like, maxDist: number): RayHit | null {
  let x = Math.floor(o.x);
  let y = Math.floor(o.y);
  let z = Math.floor(o.z);
  const sx = Math.sign(dir.x);
  const sy = Math.sign(dir.y);
  const sz = Math.sign(dir.z);
  const dx = Math.abs(1 / dir.x);
  const dy = Math.abs(1 / dir.y);
  const dz = Math.abs(1 / dir.z);
  let tx = dir.x > 0 ? (x + 1 - o.x) * dx : (o.x - x) * dx;
  let ty = dir.y > 0 ? (y + 1 - o.y) * dy : (o.y - y) * dy;
  let tz = dir.z > 0 ? (z + 1 - o.z) * dz : (o.z - z) * dz;
  let px = x;
  let py = y;
  let pz = z;
  let t = 0;
  while (t <= maxDist) {
    if (isTargetable(world.get(x, y, z))) return { x, y, z, px, py, pz };
    px = x;
    py = y;
    pz = z;
    if (tx < ty && tx < tz) {
      x += sx; t = tx; tx += dx;
    } else if (ty < tz) {
      y += sy; t = ty; ty += dy;
    } else {
      z += sz; t = tz; tz += dz;
    }
  }
  return null;
}
