import { fbm2, valueNoise2 } from "../../core/noise";
import { Block } from "../world/blocks";
import type { MapDefinition } from "./types";
import { bitmapSign, cabin, oakTree } from "./shared/structures";
import { pickLetterSpots } from "./shared/letters";

/** Rolling green hills, a pond, a little cabin and the name floating in the sky. */
export const meadow: MapDefinition = {
  id: "meadow",
  name: "Meadow",
  description: "Green hills, a pond and a cabin",
  size: { x: 80, y: 40, z: 80 },
  seed: 1,
  sky: { day: 0xbfe3ff, night: 0x0b1026, dusk: 0xffa27a },
  fog: [28, 70],
  hotbar: [Block.Grass, Block.Dirt, Block.Stone, Block.Wood, Block.Planks, Block.Leaves, Block.Glass, Block.Brick, Block.Rose],
  startTime: 0.12,

  generate(w, { rng, titleRows, letterCount }) {
    const WATER = 8;
    const spawn = { x: 40, z: 64 };
    const natural = (x: number, z: number) => 7 + fbm2(x / 26, z / 26, 1, 3) * 10 + valueNoise2(x / 6, z / 6, 2) * 2;
    const spawnH = natural(spawn.x, spawn.z);
    const height = (x: number, z: number) => {
      let h = natural(x, z);
      // Smooth the start area out to the ground's own height there (no pits or bumps).
      const d = Math.hypot(x - spawn.x, z - spawn.z);
      if (d < 8) h = h * (d / 8) + spawnH * (1 - d / 8);
      return Math.floor(h);
    };

    for (let z = 0; z < w.sz; z++) {
      for (let x = 0; x < w.sx; x++) {
        const h = height(x, z);
        const shore = h <= WATER + 1;
        for (let y = 0; y <= h; y++) {
          w.set(x, y, z, y === h ? (shore ? Block.Sand : Block.Grass) : y > h - 3 ? (shore ? Block.Sand : Block.Dirt) : Block.Stone);
        }
        for (let y = h + 1; y <= WATER; y++) w.set(x, y, z, Block.Water);
      }
    }

    for (let z = 3; z < w.sz - 3; z++) {
      for (let x = 3; x < w.sx - 3; x++) {
        const y = w.surfaceY(x, z);
        if (w.get(x, y, z) !== Block.Grass || rng() > 0.02) continue;
        if (Math.hypot(x - spawn.x, z - spawn.z) < 9) continue;
        oakTree(w, rng, x, y, z);
      }
    }

    // A cabin just west of the start.
    const cy = w.surfaceY(spawn.x - 12, spawn.z - 4);
    cabin(w, spawn.x - 14, cy, spawn.z - 6);

    // The title in rose blocks, high in the sky to the north.
    const width = titleRows[0].length;
    bitmapSign(w, titleRows, Math.floor((w.sx - width) / 2), 29, 14, Block.Rose);

    return {
      spawn: { x: spawn.x + 0.5, y: w.surfaceY(spawn.x, spawn.z) + 1, z: spawn.z + 0.5, yaw: 0 },
      letterSpots: pickLetterSpots(w, rng, letterCount, spawn),
    };
  },
};
