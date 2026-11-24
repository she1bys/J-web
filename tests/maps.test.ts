import { describe, expect, it } from "vitest";
import { MAPS } from "../src/game/maps";
import { World } from "../src/game/world/World";
import { createRng } from "../src/core/random";
import { textToRows } from "../src/fonts/pixelFont";
import { BLOCKS } from "../src/game/world/blocks";
import { Player } from "../src/game/player/Player";

describe.each(MAPS.map(m => [m.name, m] as const))("map %s", (_name, map) => {
  const world = new World(map.size.x, map.size.y, map.size.z);
  const layout = map.generate(world, { rng: createRng(map.seed), titleRows: textToRows("JOANA"), letterCount: 5 });

  it("has a unique id and a valid item bar", () => {
    expect(MAPS.filter(m => m.id === map.id)).toHaveLength(1);
    expect(map.hotbar.length).toBeGreaterThan(0);
    expect(map.hotbar.length).toBeLessThanOrEqual(9);
    for (const id of map.hotbar) expect(BLOCKS[id], `block ${id}`).toBeDefined();
  });

  it("only uses known blocks", () => {
    for (const id of new Set(world.data)) if (id !== 0) expect(BLOCKS[id], `block ${id}`).toBeDefined();
  });

  it("starts the player standing on ground, not inside a block", () => {
    const p = new Player(world);
    p.pos.set(layout.spawn.x, layout.spawn.y, layout.spawn.z);
    expect(p.collides()).toBe(false);
    expect(world.isSolid(Math.floor(layout.spawn.x), Math.floor(layout.spawn.y - 1), Math.floor(layout.spawn.z))).toBe(true);
  });

  it("hides all five letters in reachable open air", () => {
    expect(layout.letterSpots).toHaveLength(5);
    for (const s of layout.letterSpots) {
      expect(world.inBounds(Math.floor(s.x), Math.floor(s.y), Math.floor(s.z))).toBe(true);
      expect(world.isSolid(Math.floor(s.x), Math.floor(s.y), Math.floor(s.z))).toBe(false);
    }
  });
});
