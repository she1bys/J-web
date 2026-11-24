import { describe, expect, it } from "vitest";
import { MAPS } from "../src/game/maps";
import { World } from "../src/game/world/World";
import { createRng } from "../src/core/random";
import { BLOCKS } from "../src/game/world/blocks";
import { Player } from "../src/game/player/Player";
import type { MapDefinition } from "../src/game/maps/types";

const generate = (map: MapDefinition, seed: number) => {
  const world = new World(map.size.x, map.size.y, map.size.z);
  const layout = map.generate(world, { seed, rng: createRng(seed) });
  return { world, layout };
};

describe.each(MAPS.map(m => [m.name, m] as const))("map %s", (_name, map) => {
  it("has a unique id and a valid item bar", () => {
    expect(MAPS.filter(m => m.id === map.id)).toHaveLength(1);
    expect(map.hotbar.length).toBeGreaterThan(0);
    expect(map.hotbar.length).toBeLessThanOrEqual(9);
    for (const id of map.hotbar) expect(BLOCKS[id], `block ${id}`).toBeDefined();
  });

  // Every new world gets a random seed, so check a spread of them.
  it.each([map.seed, 7, 12345, 987654321, -42])("seed %i: valid blocks and a dry spawn", seed => {
    const { world, layout } = generate(map, seed);
    for (const id of new Set(world.data)) if (id !== 0) expect(BLOCKS[id], `block ${id}`).toBeDefined();

    const p = new Player(world);
    p.pos.set(layout.spawn.x, layout.spawn.y, layout.spawn.z);
    expect(p.collides()).toBe(false);
    const below = world.get(Math.floor(layout.spawn.x), Math.floor(layout.spawn.y - 1), Math.floor(layout.spawn.z));
    expect(BLOCKS[below]?.solid, "standing on solid ground").toBe(true);
    const eye = world.get(Math.floor(layout.spawn.x), Math.floor(layout.spawn.y + 1.62), Math.floor(layout.spawn.z));
    expect(eye, "head not inside a block or water").toBe(0);
  });

  it("is the same every time for the same seed", () => {
    expect(generate(map, 99).world.data).toEqual(generate(map, 99).world.data);
  });
});
