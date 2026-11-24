import type { World } from "../../world/World";
import type { Vec3 } from "../types";

/**
 * Find a dry place to start near (x, z): the nearest column whose top block is solid ground
 * (not water) with two blocks of air above it.
 */
export function findDrySpawn(world: World, x: number, z: number): Vec3 {
  for (let r = 0; r < Math.max(world.sx, world.sz); r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const cx = x + dx;
        const cz = z + dz;
        if (cx < 1 || cz < 1 || cx >= world.sx - 1 || cz >= world.sz - 1) continue;
        const y = world.surfaceY(cx, cz);
        if (y < 0 || world.topY(cx, cz) !== y || y >= world.sy - 3) continue;
        if (world.isSolid(cx, y + 1, cz) || world.isSolid(cx, y + 2, cz)) continue;
        return { x: cx + 0.5, y: y + 1, z: cz + 0.5 };
      }
    }
  }
  return { x: x + 0.5, y: world.sy - 2, z: z + 0.5 };
}
