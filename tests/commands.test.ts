import { beforeEach, describe, expect, it } from "vitest";
import { createCommands, hoursToTime, timeToHours } from "../src/game/commands/builtin";
import type { CommandContext } from "../src/game/commands/types";
import { Inventory } from "../src/game/items/Inventory";
import { World } from "../src/game/world/World";
import { Block } from "../src/game/world/blocks";
import { Item } from "../src/game/items/items";
import type { GameMode } from "../src/game/modes";

/** A minimal pretend game to run commands against. */
function fakeGame() {
  const world = new World(16, 16, 16);
  const inv = new Inventory();
  const state = {
    mode: "survival" as GameMode,
    pos: { x: 5, y: 6, z: 7 },
    spawn: { x: 1, y: 2, z: 3 },
    time: 0.25,
    flying: false,
    rules: { keepInventory: false, dayCycle: true },
    healed: false,
  };
  const ctx: CommandContext = {
    get mode() { return state.mode; },
    setMode: m => { state.mode = m; },
    get position() { return { ...state.pos }; },
    teleport: (x, y, z) => { state.pos = { x, y, z }; },
    get spawn() { return { ...state.spawn }; },
    setSpawn: (x, y, z) => { state.spawn = { x, y, z }; },
    give: (id, n) => n - inv.add(id, n),
    clearInventory: () => { const n = inv.slots.reduce((a, s) => a + (s?.count ?? 0), 0); inv.clear(); return n; },
    get time() { return state.time; },
    setTime: t => { state.time = t; },
    get rules() { return { ...state.rules }; },
    setRule: (k, v) => { state.rules[k] = v; },
    heal: () => { state.healed = true; },
    feed: () => {},
    kill: () => {},
    get flying() { return state.flying; },
    setFlying: on => (state.flying = on),
    get worldSize() { return { x: 16, y: 16, z: 16 }; },
    getBlock: (x, y, z) => world.get(x, y, z),
    setBlocks: cells => { let n = 0; for (const [x, y, z, id] of cells) if (world.inBounds(x, y, z) && world.get(x, y, z) !== id) { world.set(x, y, z, id); n++; } return n; },
    seed: 42,
    worldName: "Test",
  };
  return { ctx, state, world, inv };
}

describe("commands", () => {
  const reg = createCommands();
  let g: ReturnType<typeof fakeGame>;
  beforeEach(() => { g = fakeGame(); });
  const run = (line: string) => reg.execute(line, g.ctx);

  it("switches game mode", () => {
    expect(run("/gamemode creative").ok).toBe(true);
    expect(g.state.mode).toBe("creative");
    expect(run("/gm s").ok).toBe(true);
    expect(g.state.mode).toBe("survival");
    expect(run("/gamemode banana").ok).toBe(false);
  });

  it("teleports with absolute and ~ relative coordinates", () => {
    run("/tp 10 20 30");
    expect(g.state.pos).toEqual({ x: 10, y: 20, z: 30 });
    run("/tp ~ ~5 ~-2");
    expect(g.state.pos).toEqual({ x: 10, y: 25, z: 28 });
    expect(run("/tp 1 2").ok).toBe(false);
  });

  it("gives items by name", () => {
    expect(run("/give stone_pickaxe").ok).toBe(true);
    expect(run("/give planks 70").message).toMatch(/Gave 70 Planks/);
    expect(g.inv.count(Item.StonePickaxe)).toBe(1);
    expect(g.inv.count(Block.Planks)).toBe(70);
    expect(run("/give unicorn").ok).toBe(false);
  });

  it("sets and fills blocks, with a size limit", () => {
    expect(run("/setblock 1 1 1 stone").ok).toBe(true);
    expect(g.world.get(1, 1, 1)).toBe(Block.Stone);
    expect(run("/fill 0 0 0 3 0 3 glass").message).toBe("Filled 16 blocks");
    expect(run("/fill 0 0 0 1000 100 1000 air").ok).toBe(false);
  });

  it("handles time by name and hours", () => {
    run("/time set noon");
    expect(timeToHours(g.state.time)).toBeCloseTo(12);
    run("/time set 18");
    expect(g.state.time).toBeCloseTo(hoursToTime(18));
    expect(run("/time query").message).toBe("It's 18:00");
  });

  it("reads and sets game rules", () => {
    expect(run("/gamerule keepInventory true").ok).toBe(true);
    expect(g.state.rules.keepInventory).toBe(true);
  });

  it("only lets you fly in creative", () => {
    expect(run("/fly").ok).toBe(false);
    run("/gamemode creative");
    expect(run("/fly").message).toBe("Flying on");
  });

  it("explains unknown commands and suggests completions", () => {
    expect(run("/dance").message).toMatch(/Unknown command/);
    expect(reg.complete("/ga", g.ctx)).toEqual(expect.arrayContaining(["/gamemode", "/gamerule"]));
    expect(reg.complete("/give stone_p", g.ctx)).toContain("/give stone_pickaxe");
  });
});
