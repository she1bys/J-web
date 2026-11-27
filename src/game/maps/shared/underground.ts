import { valueNoise3 } from "../../../core/noise";
import type { Rng } from "../../../core/random";
import { Block } from "../../world/blocks";
import type { World } from "../../world/World";

/** An unbreakable floor (with a ragged top) so nobody digs out of the world. */
export function bedrock(w: World, rng: Rng): void {
  for (let z = 0; z < w.sz; z++) {
    for (let x = 0; x < w.sx; x++) {
      w.set(x, 0, z, Block.Bedrock);
      if (rng() < 0.35 && w.get(x, 1, z) === Block.Stone) w.set(x, 1, z, Block.Bedrock);
    }
  }
}

/**
 * Winding tunnels and the odd larger cavern, carved from 3D noise. Tunnels are where two
 * noise fields are both close to their middle value, which traces long connected worms.
 * Caves stay below the surface layer except for rare openings, and never break into water.
 */
export function carveCaves(w: World, seed: number, options: { minDepth?: number; avoid?: (x: number, z: number) => boolean } = {}): void {
  const { minDepth = 2, avoid } = options;
  for (let z = 1; z < w.sz - 1; z++) {
    for (let x = 1; x < w.sx - 1; x++) {
      if (avoid?.(x, z)) continue;
      const top = w.surfaceY(x, z);
      if (top < 4 || w.topY(x, z) !== top) continue; // under water: leave it alone
      for (let y = 2; y < top; y++) {
        const depth = top - y;
        const a = valueNoise3(x / 16, y / 9, z / 16, seed + 100);
        const b = valueNoise3(x / 16, y / 9, z / 16, seed + 101);
        let tunnel = Math.abs(a - 0.5) < 0.04 && Math.abs(b - 0.5) < 0.09;
        // Bigger caverns, only well below ground
        if (!tunnel && depth > 7) tunnel = valueNoise3(x / 22, y / 12, z / 22, seed + 102) > 0.8;
        if (!tunnel) continue;
        // Rare openings to the surface; otherwise keep a roof of at least `minDepth` blocks
        if (depth < minDepth && valueNoise3(x / 30, 0, z / 30, seed + 103) < 0.82) continue;
        const id = w.get(x, y, z);
        if (id === Block.Bedrock || id === Block.Water) continue;
        if (w.isWater(x, y + 1, z)) continue;
        w.set(x, y, z, Block.Air);
      }
    }
  }
}

/** Veins of coal (common, any depth) and iron (rarer, deeper). Ores only replace stone. */
export function placeOres(w: World, rng: Rng): void {
  const area = (w.sx * w.sz) / (64 * 64);
  const vein = (id: number, count: number, size: [number, number], maxY: (x: number, z: number) => number) => {
    for (let v = 0; v < count; v++) {
      let x = Math.floor(rng() * w.sx);
      let z = Math.floor(rng() * w.sz);
      const top = maxY(x, z);
      if (top < 3) continue;
      let y = 1 + Math.floor(rng() * (top - 1));
      const n = size[0] + Math.floor(rng() * (size[1] - size[0] + 1));
      for (let k = 0; k < n; k++) {
        if (w.get(x, y, z) === Block.Stone) w.set(x, y, z, id);
        // Wander to a neighbouring cell for the next piece of the vein
        const step = Math.floor(rng() * 6);
        if (step === 0) x++; else if (step === 1) x--; else if (step === 2) y++; else if (step === 3) y--; else if (step === 4) z++; else z--;
      }
    }
  };
  vein(Block.CoalOre, Math.round(40 * area), [5, 10], (x, z) => w.surfaceY(x, z) - 2);
  vein(Block.IronOre, Math.round(22 * area), [3, 7], (x, z) => Math.min(w.surfaceY(x, z) - 5, Math.floor(w.sy * 0.6)));
}
