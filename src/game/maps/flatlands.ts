import { Block } from "../world/blocks";
import type { MapDefinition } from "./types";
import { bitmapSign } from "./shared/structures";
import { pickLetterSpots } from "./shared/letters";

/** A flat, open space for building. You can fly here. */
export const flatlands: MapDefinition = {
  id: "flatlands",
  name: "Flatlands",
  description: "Creative mode: build anything, fly",
  size: { x: 80, y: 48, z: 80 },
  seed: 5,
  sky: { day: 0xc8e6ff, night: 0x0b1026, dusk: 0xffb38a },
  fog: [36, 90],
  hotbar: [Block.Grass, Block.Planks, Block.Brick, Block.Cobble, Block.Glass, Block.Sandstone, Block.Ice, Block.Lantern, Block.Rose],
  startTime: 0.2,
  allowFlight: true,

  generate(w, { rng, titleRows, letterCount }) {
    const GROUND = 4;
    w.fill(0, 0, 0, w.sx - 1, 0, w.sz - 1, Block.Stone);
    w.fill(0, 1, 0, w.sx - 1, GROUND - 1, w.sz - 1, Block.Dirt);
    w.fill(0, GROUND, 0, w.sx - 1, GROUND, w.sz - 1, Block.Grass);

    // The title standing on the ground, ahead of the start.
    const width = titleRows[0].length;
    bitmapSign(w, titleRows, Math.floor((w.sx - width) / 2), GROUND + 1, 20, Block.Rose);

    const spawn = { x: 40, z: 60 };
    return {
      spawn: { x: spawn.x + 0.5, y: GROUND + 1, z: spawn.z + 0.5, yaw: 0 },
      letterSpots: pickLetterSpots(w, rng, letterCount, spawn, { minApart: 14 }),
    };
  },
};
