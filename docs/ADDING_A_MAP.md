# Adding a map

Each map is one file in `src/game/maps/` that exports a `MapDefinition` (see `types.ts`).

## 1. Create the file

```ts
// src/game/maps/cherryGrove.ts
import { fbm2 } from "../../core/noise";
import { Block } from "../world/blocks";
import type { MapDefinition } from "./types";
import { oakTree } from "./shared/structures";
import { findDrySpawn } from "./shared/spawn";

export const cherryGrove: MapDefinition = {
  id: "cherry-grove",            // never change once people have played it (used for saves)
  name: "Cherry Grove",
  description: "Soft hills and pink trees",
  size: { x: 80, y: 40, z: 80 }, // keep x and z at most ~128 for phones
  seed: 6,                       // only used for very old saves; new worlds pick their own
  sky: { day: 0xffe3f0, night: 0x140a22, dusk: 0xff9ab8 },
  fog: [28, 70],
  hotbar: [Block.Grass, Block.Planks, Block.Rose],
  startTime: 0.15,

  generate(w, { seed, rng }) {
    for (let z = 0; z < w.sz; z++) {
      for (let x = 0; x < w.sx; x++) {
        // Always mix the world's seed into noise, so every world is different.
        const h = Math.floor(8 + fbm2(x / 24, z / 24, seed) * 8);
        w.fill(x, 0, z, x, h - 1, z, Block.Dirt);
        w.set(x, h, z, Block.Grass);
      }
    }
    // ...trees (use rng so they're placed the same way for the same seed), buildings
    return { spawn: { ...findDrySpawn(w, 40, 64), yaw: 0 } };
  },
};
```

## 2. Register it

Add it to the list in `src/game/maps/index.ts`. The order there is the order on the map select screen.

## 3. Run the checks

```bash
npm run check
```

The tests in `tests/maps.test.ts` run automatically for every registered map, across several seeds.
They check that every block is valid, the same seed always builds the same world, and the player
starts on dry ground with nothing in the way.

## Adding a new block

1. Add an id in `Block` and a tile in `Tile` (`src/game/world/blocks.ts`).
2. Paint its 16×16 texture in `src/game/textures/atlas.ts` (the atlas has free slots).
3. Add a `def(...)` entry with its name, tiles, sound and hardness.
4. Optional: which tool mines it fastest and what it drops (`src/game/items/drops.ts`),
   and a crafting recipe (`src/game/items/recipes.ts`). It appears in the creative palette
   and in `/give` automatically.
