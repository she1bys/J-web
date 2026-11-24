# Adding a map

Each map is one file in `src/game/maps/` that exports a `MapDefinition` (see `types.ts`).

## 1. Create the file

```ts
// src/game/maps/cherryGrove.ts
import { fbm2 } from "../../core/noise";
import { Block } from "../world/blocks";
import type { MapDefinition } from "./types";
import { oakTree, bitmapSign } from "./shared/structures";
import { pickLetterSpots } from "./shared/letters";

export const cherryGrove: MapDefinition = {
  id: "cherry-grove",            // never change once people have played it (used for saves)
  name: "Cherry Grove",
  description: "Soft hills and pink trees",
  size: { x: 80, y: 40, z: 80 }, // keep x and z at most ~128 for phones
  seed: 6,
  sky: { day: 0xffe3f0, night: 0x140a22, dusk: 0xff9ab8 },
  fog: [28, 70],
  hotbar: [Block.Grass, Block.Planks, Block.Rose],
  startTime: 0.15,

  generate(w, { rng, titleRows, letterCount }) {
    const spawn = { x: 40, z: 64 };
    for (let z = 0; z < w.sz; z++) {
      for (let x = 0; x < w.sx; x++) {
        const h = Math.floor(8 + fbm2(x / 24, z / 24, 6) * 8);
        w.fill(x, 0, z, x, h - 1, z, Block.Dirt);
        w.set(x, h, z, Block.Grass);
      }
    }
    // ...trees, buildings, a title sign with bitmapSign(...)
    return {
      spawn: { x: spawn.x + 0.5, y: w.surfaceY(spawn.x, spawn.z) + 1, z: spawn.z + 0.5, yaw: 0 },
      letterSpots: pickLetterSpots(w, rng, letterCount, spawn),
    };
  },
};
```

## 2. Register it

Add it to the list in `src/game/maps/index.ts`. The order there is the order on the map select screen.

## 3. Run the checks

```bash
npm run check
```

The tests in `tests/maps.test.ts` run automatically for every registered map. They check that the
player starts on solid ground and that all hidden letters are placed somewhere reachable.

## Adding a new block

1. Add an id in `Block` and a tile in `Tile` (`src/game/world/blocks.ts`).
2. Paint its 16×16 texture in `src/game/textures/atlas.ts` (the atlas has free slots).
3. Add a `def(...)` entry with its name, tiles, sound and hardness.
