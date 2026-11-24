import type { Rng } from "../../../core/random";
import type { World } from "../../world/World";
import type { Vec3 } from "../types";

/**
 * Pick spots on dry ground for the hidden letters: away from the start and from each other,
 * so finding them means exploring the whole map.
 */
export function pickLetterSpots(
  world: World,
  rng: Rng,
  count: number,
  spawn: { x: number; z: number },
  options: { minFromSpawn?: number; minApart?: number; margin?: number; accept?: (x: number, y: number, z: number) => boolean } = {},
): Vec3[] {
  const { minFromSpawn = 12, minApart = 10, margin = 4, accept } = options;
  const spots: Vec3[] = [];
  for (let attempt = 0; attempt < 4000 && spots.length < count; attempt++) {
    // Relax the spacing rules gradually if the map is cramped.
    const relax = Math.max(0.4, 1 - attempt / 4000);
    const x = margin + Math.floor(rng() * (world.sx - margin * 2));
    const z = margin + Math.floor(rng() * (world.sz - margin * 2));
    const y = world.surfaceY(x, z);
    if (y < 0 || y >= world.sy - 3) continue;
    if (world.topY(x, z) !== y) continue; // under water
    if (Math.hypot(x - spawn.x, z - spawn.z) < minFromSpawn * relax) continue;
    if (spots.some(s => Math.hypot(s.x - x, s.z - z) < minApart * relax)) continue;
    if (accept && !accept(x, y, z)) continue;
    spots.push({ x: x + 0.5, y: y + 1.6, z: z + 0.5 });
  }
  return spots;
}
