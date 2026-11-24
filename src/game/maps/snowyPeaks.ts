import { fbm2 } from "../../core/noise";
import { Block } from "../world/blocks";
import type { MapDefinition } from "./types";
import { bitmapSign, pineTree } from "./shared/structures";
import { pickLetterSpots } from "./shared/letters";

/** Tall mountains with snowy caps, pine forests and a frozen lake. */
export const snowyPeaks: MapDefinition = {
  id: "snowy-peaks",
  name: "Snowy Peaks",
  description: "Mountains, pines and a frozen lake",
  size: { x: 80, y: 56, z: 80 },
  seed: 3,
  sky: { day: 0xdbe8f2, night: 0x0a0f22, dusk: 0xf2a3b8 },
  fog: [24, 64],
  hotbar: [Block.Snow, Block.SnowyGrass, Block.Ice, Block.Stone, Block.Cobble, Block.Wood, Block.PineLeaves, Block.Lantern, Block.Rose],
  startTime: 0.1,

  generate(w, { rng, titleRows, letterCount }) {
    const LAKE = 12;
    const SNOWLINE = 27;
    const spawn = { x: 40, z: 66 };
    // Ridged noise makes sharp peaks with valleys between them.
    const natural = (x: number, z: number) => {
      const ridge = 1 - Math.abs(fbm2(x / 34, z / 34, 11, 4) * 2 - 1);
      return 9 + ridge * ridge * 34 + fbm2(x / 8, z / 8, 12, 2) * 3;
    };
    const spawnH = natural(spawn.x, spawn.z);

    for (let z = 0; z < w.sz; z++) {
      for (let x = 0; x < w.sx; x++) {
        let h = natural(x, z);
        // Smooth the start area out to the ground's own height there.
        const d = Math.hypot(x - spawn.x, z - spawn.z);
        if (d < 10) h = h * (d / 10) + spawnH * (1 - d / 10);
        const top = Math.min(w.sy - 2, Math.floor(h));
        for (let y = 0; y <= top; y++) {
          let id: number = Block.Stone;
          if (y === top) id = top >= SNOWLINE ? Block.Snow : Block.SnowyGrass;
          else if (y > top - 3 && top < SNOWLINE) id = Block.Dirt;
          else if (y > top - 2) id = Block.Snow;
          w.set(x, y, z, id);
        }
        for (let y = top + 1; y < LAKE; y++) w.set(x, y, z, Block.Water);
        if (top < LAKE) w.set(x, LAKE, z, Block.Ice);
      }
    }

    for (let z = 3; z < w.sz - 3; z++) {
      for (let x = 3; x < w.sx - 3; x++) {
        const y = w.surfaceY(x, z);
        if (w.get(x, y, z) !== Block.SnowyGrass || rng() > 0.03) continue;
        if (Math.hypot(x - spawn.x, z - spawn.z) < 7) continue;
        pineTree(w, rng, x, y, z, rng() < 0.5);
      }
    }

    const width = titleRows[0].length;
    bitmapSign(w, titleRows, Math.floor((w.sx - width) / 2), 46, 10, Block.Rose);

    return {
      spawn: { x: spawn.x + 0.5, y: w.surfaceY(spawn.x, spawn.z) + 1, z: spawn.z + 0.5, yaw: 0 },
      letterSpots: pickLetterSpots(w, rng, letterCount, spawn, { accept: (_x, y) => y < 40 }),
    };
  },
};
