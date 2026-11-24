import { fbm2 } from "../../core/noise";
import { Block } from "../world/blocks";
import type { MapDefinition } from "./types";
import { bitmapSign, palmTree } from "./shared/structures";
import { pickLetterSpots } from "./shared/letters";

/** Sandy islands in a warm sea, always close to golden hour. Swim between them. */
export const sunsetIslands: MapDefinition = {
  id: "sunset-islands",
  name: "Sunset Islands",
  description: "Palm islands in a golden sea",
  size: { x: 96, y: 32, z: 96 },
  seed: 4,
  sky: { day: 0xffc9a3, night: 0x1a0b2e, dusk: 0xff6f91 },
  fog: [30, 80],
  hotbar: [Block.Sand, Block.Grass, Block.PalmWood, Block.Planks, Block.Leaves, Block.Glass, Block.Lantern, Block.Brick, Block.Rose],
  startTime: 0.44,

  generate(w, { rng, titleRows, letterCount }) {
    const SEA = 9;
    const cx = w.sx / 2;
    const cz = w.sz / 2;

    for (let z = 0; z < w.sz; z++) {
      for (let x = 0; x < w.sx; x++) {
        // Island blobs: noise, pulled down toward the map edges so the sea surrounds everything.
        const edge = Math.min(x, z, w.sx - 1 - x, w.sz - 1 - z) / 16;
        const n = fbm2(x / 20, z / 20, 21, 4) * Math.min(1, edge);
        const h = Math.floor(3 + n * 15);
        for (let y = 0; y <= h; y++) {
          const land = h > SEA;
          w.set(x, y, z, y === h ? (land && h > SEA + 2 ? Block.Grass : Block.Sand) : y > h - 3 ? Block.Sand : Block.Stone);
        }
        for (let y = h + 1; y <= SEA; y++) w.set(x, y, z, Block.Water);
      }
    }

    // Start on dry land nearest the middle of the map.
    let spawn = { x: Math.floor(cx), z: Math.floor(cz) };
    search: for (let r = 0; r < 48; r++) {
      for (let a = 0; a < 32; a++) {
        const x = Math.round(cx + Math.cos((a / 32) * Math.PI * 2) * r);
        const z = Math.round(cz + Math.sin((a / 32) * Math.PI * 2) * r);
        if (w.surfaceY(x, z) > SEA && w.topY(x, z) === w.surfaceY(x, z)) {
          spawn = { x, z };
          break search;
        }
      }
    }

    for (let z = 3; z < w.sz - 3; z++) {
      for (let x = 3; x < w.sx - 3; x++) {
        const y = w.surfaceY(x, z);
        if (y <= SEA || rng() > 0.02) continue;
        if (Math.hypot(x - spawn.x, z - spawn.z) < 5) continue;
        palmTree(w, rng, x, y, z);
      }
    }

    const width = titleRows[0].length;
    bitmapSign(w, titleRows, Math.floor((w.sx - width) / 2), 22, 8, Block.Rose);

    return {
      spawn: { x: spawn.x + 0.5, y: w.surfaceY(spawn.x, spawn.z) + 1, z: spawn.z + 0.5, yaw: 0 },
      letterSpots: pickLetterSpots(w, rng, letterCount, spawn, { minApart: 14, minFromSpawn: 10 }),
    };
  },
};
