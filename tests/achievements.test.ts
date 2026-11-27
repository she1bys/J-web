import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, Achievements } from "../src/game/progress/Achievements";
import { SURVIVAL_TIPS } from "../src/game/progress/Tips";
import { Inventory } from "../src/game/items/Inventory";
import { Block } from "../src/game/world/blocks";
import { Item } from "../src/game/items/items";

describe("achievements", () => {
  it("unlock once, from the right events", () => {
    const seen: string[] = [];
    const a = new Achievements(d => seen.push(d.id));
    a.pickedUp(Block.Wood);
    a.pickedUp(Block.Wood);
    a.crafted(Block.CraftingTable);
    a.crafted(Item.StonePickaxe);
    expect(seen).toEqual(["wood", "table", "pickaxe", "stone"]);
  });

  it("night owl needs a whole night survived, and dying resets it", () => {
    const seen: string[] = [];
    const a = new Achievements(d => seen.push(d.id));
    a.timeOfDay(0.5, 0.56, true, true); // night falls
    a.died();
    a.timeOfDay(0.98, 0.995, true, true); // morning, but we died
    expect(seen).not.toContain("night");
    a.timeOfDay(0.54, 0.56, true, true);
    a.timeOfDay(0.985, 0.995, true, true);
    expect(seen).toContain("night");
  });

  it("survival-only achievements can be blocked (creative)", () => {
    const seen: string[] = [];
    const a = new Achievements(d => seen.push(d.id), undefined, d => !d.survival);
    a.unlock("sleep");
    a.unlock("torch");
    expect(seen).toEqual(["torch"]);
  });

  it("counts blocks placed and distance walked across saves", () => {
    const a = new Achievements(() => {});
    for (let i = 0; i < 60; i++) a.placedBlock(Block.Dirt);
    const b = new Achievements(() => {}, a.save(0));
    for (let i = 0; i < 40; i++) b.placedBlock(Block.Dirt);
    expect(b.got.has("builder")).toBe(true);
  });

  it("ids are unique and every tip step can complete", () => {
    expect(new Set(ACHIEVEMENTS.map(a => a.id)).size).toBe(ACHIEVEMENTS.length);
    const inv = new Inventory();
    const got = new Set(ACHIEVEMENTS.map(a => a.id));
    for (const t of SURVIVAL_TIPS) expect(t.done({ inv, got, touch: false, time: 0 })).toBe(true);
  });
});
