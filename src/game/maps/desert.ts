import { fbm2 } from "../../core/noise";
import { Block } from "../world/blocks";
import type { MapDefinition } from "./types";
import { cactus, palmTree, pyramid } from "./shared/structures";
import { findDrySpawn } from "./shared/spawn";
import { bedrock, carveCaves, placeOres } from "./shared/underground";

/** Sand dunes, cacti, a palm oasis and a stepped pyramid. */
export const desert: MapDefinition = {
  id: "desert",
  name: "Desert",
  description: "Dunes, an oasis and a pyramid",
  size: { x: 96, y: 40, z: 96 },
  seed: 2,
  sky: { day: 0xd6ecf7, night: 0x120d24, dusk: 0xff9a5a },
  ambience: { wind: 0.85, birds: 0.1, waves: 0, crickets: 0.35 },
  fog: [32, 84],
  hotbar: [Block.Sand, Block.Sandstone, Block.Cactus, Block.PalmWood, Block.Planks, Block.Glass, Block.Brick, Block.Lantern, Block.Rose],
  startTime: 0.18,

  generate(w, { seed, rng }) {
    const spawn = { x: 48, z: 80 };
    const oasis = { x: 70, z: 40, r: 8 };
    const pyr = { x: 28, z: 34, half: 9 };
    const WATER = 8;

    for (let z = 0; z < w.sz; z++) {
      for (let x = 0; x < w.sx; x++) {
        // Long smooth dunes, flattened near the oasis and the pyramid.
        let h = 9 + fbm2(x / 30, z / 18, seed + 5, 3) * 8;
        const dOasis = Math.hypot(x - oasis.x, z - oasis.z);
        if (dOasis < oasis.r + 6) {
          const f = Math.max(0, (dOasis - oasis.r) / 6);
          h = h * f + 6 * (1 - f);
        }
        const dPyr = Math.max(Math.abs(x - pyr.x), Math.abs(z - pyr.z));
        if (dPyr < pyr.half + 4) h = 10;
        const top = Math.floor(h);
        for (let y = 0; y <= top; y++) {
          w.set(x, y, z, y > top - 4 ? Block.Sand : y > top - 8 ? Block.Sandstone : Block.Stone);
        }
        if (dOasis < oasis.r) for (let y = top + 1; y <= WATER; y++) w.set(x, y, z, Block.Water);
        else if (dOasis < oasis.r + 3 && top <= WATER + 1) w.set(x, top, z, Block.Grass);
      }
    }

    carveCaves(w, seed, {
      avoid: (x, z) => Math.hypot(x - spawn.x, z - spawn.z) < 8 || Math.max(Math.abs(x - pyr.x), Math.abs(z - pyr.z)) < pyr.half + 3 || Math.hypot(x - oasis.x, z - oasis.z) < oasis.r + 4,
    });
    placeOres(w, rng);
    bedrock(w, rng);
    pyramid(w, pyr.x, 11, pyr.z, pyr.half);

    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      const x = Math.round(oasis.x + Math.cos(a) * (oasis.r + 1.5));
      const z = Math.round(oasis.z + Math.sin(a) * (oasis.r + 1.5));
      palmTree(w, rng, x, w.surfaceY(x, z), z);
    }

    for (let z = 3; z < w.sz - 3; z++) {
      for (let x = 3; x < w.sx - 3; x++) {
        const y = w.surfaceY(x, z);
        if (w.get(x, y, z) !== Block.Sand || rng() > 0.006) continue;
        if (Math.hypot(x - spawn.x, z - spawn.z) < 5) continue;
        cactus(w, rng, x, y, z);
      }
    }

    const start = findDrySpawn(w, spawn.x, spawn.z);
    return {
      spawn: { ...start, yaw: 0 },
    };
  },
};
