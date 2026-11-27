import { describe, expect, it } from "vitest";
import { Inventory } from "../src/game/items/Inventory";
import { Item, findItem, itemDef } from "../src/game/items/items";
import { RECIPES, craft, hasIngredients } from "../src/game/items/recipes";
import { blockDrops, miningInfo } from "../src/game/items/drops";
import { Block } from "../src/game/world/blocks";
import { createRng } from "../src/core/random";

describe("Inventory", () => {
  it("stacks to 64 and fills the hotbar first", () => {
    const inv = new Inventory();
    expect(inv.add(Block.Dirt, 100)).toBe(0);
    expect(inv.get(0)).toEqual({ id: Block.Dirt, count: 64 });
    expect(inv.get(1)).toEqual({ id: Block.Dirt, count: 36 });
    expect(inv.count(Block.Dirt)).toBe(100);
  });

  it("keeps tools unstacked with durability", () => {
    const inv = new Inventory();
    inv.add(Item.StonePickaxe, 2);
    expect(inv.get(0)).toMatchObject({ id: Item.StonePickaxe, count: 1, dur: itemDef(Item.StonePickaxe)!.tool!.durability });
    expect(inv.get(1)?.id).toBe(Item.StonePickaxe);
  });

  it("returns what doesn't fit", () => {
    const inv = new Inventory();
    expect(inv.add(Block.Stone, 64 * 36 + 5)).toBe(5);
    expect(inv.space(Block.Stone)).toBe(0);
  });

  it("removes only when there are enough", () => {
    const inv = new Inventory();
    inv.add(Block.Sand, 3);
    expect(inv.remove(Block.Sand, 4)).toBe(false);
    expect(inv.count(Block.Sand)).toBe(3);
    expect(inv.remove(Block.Sand, 3)).toBe(true);
    expect(inv.isEmpty()).toBe(true);
  });

  it("wears tools down until they break", () => {
    const inv = new Inventory();
    inv.add(Item.WoodenShovel, 1);
    const uses = itemDef(Item.WoodenShovel)!.tool!.durability;
    for (let i = 0; i < uses - 1; i++) expect(inv.wear(0)).toBe(false);
    expect(inv.wear(0)).toBe(true);
    expect(inv.get(0)).toBeNull();
  });

  it("saves and loads", () => {
    const a = new Inventory();
    a.add(Block.Wood, 10);
    a.add(Item.WoodenAxe, 1);
    a.wear(1);
    const b = new Inventory();
    b.load(a.save());
    expect(b.slots).toEqual(a.slots);
  });

  it("quick-moves between backpack and hotbar", () => {
    const inv = new Inventory();
    inv.set(20, { id: Block.Glass, count: 5 });
    inv.quickMove(20);
    expect(inv.get(0)).toEqual({ id: Block.Glass, count: 5 });
    expect(inv.get(20)).toBeNull();
  });
});

describe("crafting", () => {
  it("turns wood into planks into sticks into a pickaxe", () => {
    const inv = new Inventory();
    inv.add(Block.Wood, 2);
    const find = (id: number) => RECIPES.find(r => r.result.id === id && hasIngredients(inv, r))!;
    expect(craft(inv, find(Block.Planks))).toBe(true);
    expect(craft(inv, find(Block.Planks))).toBe(true);
    expect(inv.count(Block.Planks)).toBe(8);
    expect(craft(inv, find(Item.Stick))).toBe(true);
    expect(craft(inv, find(Item.WoodenPickaxe))).toBe(false); // needs a crafting table
    expect(craft(inv, find(Item.WoodenPickaxe), new Set(["hand", "table"]))).toBe(true);
    expect(inv.count(Item.WoodenPickaxe)).toBe(1);
    expect(inv.count(Item.Stick)).toBe(2);
    expect(inv.count(Block.Planks)).toBe(3);
  });

  it("smelts iron only next to a furnace, with fuel", () => {
    const inv = new Inventory();
    inv.add(Block.IronOre, 1);
    inv.add(Item.Coal, 1);
    const iron = RECIPES.find(r => r.result.id === Item.IronIngot && r.ingredients.some(i => i.id === Item.Coal))!;
    expect(iron.station).toBe("furnace");
    expect(craft(inv, iron, new Set(["hand", "table"]))).toBe(false);
    expect(craft(inv, iron, new Set(["hand", "furnace"]))).toBe(true);
    expect(inv.count(Item.IronIngot)).toBe(1);
    expect(inv.count(Item.Coal)).toBe(0);
  });

  it("refuses without ingredients and changes nothing", () => {
    const inv = new Inventory();
    inv.add(Block.Planks, 1);
    const pick = RECIPES.find(r => r.result.id === Item.WoodenPickaxe)!;
    expect(craft(inv, pick)).toBe(false);
    expect(inv.count(Block.Planks)).toBe(1);
  });

  it("every recipe uses real items", () => {
    for (const r of RECIPES) {
      expect(itemDef(r.result.id)).toBeDefined();
      for (const i of r.ingredients) expect(itemDef(i.id)).toBeDefined();
    }
  });
});

describe("mining and drops", () => {
  const stonePick = itemDef(Item.StonePickaxe)!.tool;
  it("stone needs a pickaxe to drop and is slow by hand", () => {
    expect(miningInfo(Block.Stone, undefined).drops).toBe(false);
    expect(miningInfo(Block.Stone, stonePick).drops).toBe(true);
    expect(miningInfo(Block.Stone, stonePick).seconds).toBeLessThan(miningInfo(Block.Stone, undefined).seconds);
  });

  it("the right tool is faster; the wrong one isn't", () => {
    const axe = itemDef(Item.StoneAxe)!.tool;
    expect(miningInfo(Block.Wood, axe).seconds).toBeLessThan(miningInfo(Block.Wood, undefined).seconds);
    expect(miningInfo(Block.Dirt, axe).seconds).toBe(miningInfo(Block.Dirt, undefined).seconds);
  });

  it("iron ore needs at least a stone pickaxe", () => {
    expect(miningInfo(Block.IronOre, itemDef(Item.WoodenPickaxe)!.tool).drops).toBe(false);
    expect(miningInfo(Block.IronOre, itemDef(Item.StonePickaxe)!.tool).drops).toBe(true);
    expect(miningInfo(Block.CoalOre, itemDef(Item.WoodenPickaxe)!.tool).drops).toBe(true);
    expect(miningInfo(Block.Bedrock, itemDef(Item.IronPickaxe)!.tool).seconds).toBe(Infinity);
  });

  it("ripe wheat drops wheat and seeds; unripe only seeds", () => {
    const rng = createRng(2);
    expect(blockDrops(Block.Wheat, rng, 3).map(d => d.id)).toEqual([Item.Wheat, Item.Seeds]);
    expect(blockDrops(Block.Wheat, rng, 1)).toEqual([{ id: Item.Seeds, count: 1 }]);
    expect(blockDrops(Block.CoalOre, rng)).toEqual([{ id: Item.Coal, count: 1 }]);
  });

  it("grass drops dirt, stone drops cobblestone, glass drops nothing", () => {
    const rng = createRng(1);
    expect(blockDrops(Block.Grass, rng)[0]).toEqual({ id: Block.Dirt, count: 1 });
    expect(blockDrops(Block.Stone, rng)).toEqual([{ id: Block.Cobble, count: 1 }]);
    expect(blockDrops(Block.Glass, rng)).toEqual([]);
  });

  it("leaves sometimes drop apples", () => {
    const rng = createRng(3);
    const drops = Array.from({ length: 500 }, () => blockDrops(Block.Leaves, rng)).flat();
    expect(drops.some(d => d.id === Item.Apple)).toBe(true);
  });

  it("finds items by friendly names", () => {
    expect(findItem("stone_pickaxe")?.id).toBe(Item.StonePickaxe);
    expect(findItem("Stone Pickaxe")?.id).toBe(Item.StonePickaxe);
    expect(findItem("apples")?.id).toBe(Item.Apple);
    expect(findItem("cobblestone")?.id).toBe(Block.Cobble);
    expect(findItem("nope")).toBeUndefined();
  });
});
