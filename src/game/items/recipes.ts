import { Block } from "../world/blocks";
import { Item } from "./items";
import type { Inventory } from "./Inventory";

export interface Ingredient {
  id: number;
  count: number;
}

/** Where a recipe can be made: anywhere, next to a crafting table, or next to a furnace. */
export type Station = "hand" | "table" | "furnace";

export interface Recipe {
  result: Ingredient;
  ingredients: Ingredient[];
  station: Station;
}

const r = (station: Station, id: number, count: number, ...ingredients: [number, number][]): Recipe => ({
  station,
  result: { id, count },
  ingredients: ingredients.map(([i, c]) => ({ id: i, count: c })),
});

/** Furnace recipes burn either coal or a couple of planks. */
const smelt = (input: number, output: number): Recipe[] => [
  r("furnace", output, 1, [input, 1], [Item.Coal, 1]),
  r("furnace", output, 1, [input, 1], [Block.Planks, 2]),
];

/** Tools of every material: [planks | cobblestone | iron ingot]. */
const tools = (mat: number, pick: number, axe: number, shovel: number, sword: number, hoe: number): Recipe[] => [
  r("table", pick, 1, [mat, 3], [Item.Stick, 2]),
  r("table", axe, 1, [mat, 3], [Item.Stick, 2]),
  r("table", shovel, 1, [mat, 1], [Item.Stick, 2]),
  r("table", sword, 1, [mat, 2], [Item.Stick, 1]),
  r("table", hoe, 1, [mat, 2], [Item.Stick, 2]),
];

/** Everything that can be crafted. */
export const RECIPES: readonly Recipe[] = [
  // By hand
  r("hand", Block.Planks, 4, [Block.Wood, 1]),
  r("hand", Block.Planks, 4, [Block.PalmWood, 1]),
  r("hand", Item.Stick, 4, [Block.Planks, 2]),
  r("hand", Block.CraftingTable, 1, [Block.Planks, 4]),
  r("hand", Block.Torch, 4, [Item.Coal, 1], [Item.Stick, 1]),
  r("hand", Block.Ice, 1, [Block.Snow, 4]),
  // At a crafting table
  ...tools(Block.Planks, Item.WoodenPickaxe, Item.WoodenAxe, Item.WoodenShovel, Item.WoodenSword, Item.WoodenHoe),
  ...tools(Block.Cobble, Item.StonePickaxe, Item.StoneAxe, Item.StoneShovel, Item.StoneSword, Item.StoneHoe),
  ...tools(Item.IronIngot, Item.IronPickaxe, Item.IronAxe, Item.IronShovel, Item.IronSword, Item.IronHoe),
  r("table", Block.Chest, 1, [Block.Planks, 8]),
  r("table", Block.Furnace, 1, [Block.Cobble, 8]),
  r("table", Block.Bed, 1, [Item.Fluff, 3], [Block.Planks, 3]),
  r("table", Item.Bread, 1, [Item.Wheat, 3]),
  r("table", Block.Sandstone, 1, [Block.Sand, 4]),
  r("table", Block.Brick, 2, [Block.Cobble, 2], [Block.Sand, 2]),
  r("table", Block.Lantern, 1, [Block.Glass, 1], [Block.Torch, 1]),
  r("table", Block.Rose, 1, [Item.Apple, 1], [Block.Glass, 1]),
  // In a furnace
  ...smelt(Block.IronOre, Item.IronIngot),
  ...smelt(Block.Sand, Block.Glass),
  ...smelt(Block.Cobble, Block.Stone),
  ...smelt(Item.RawMeat, Item.CookedMeat),
];

export const STATION_NAMES: Record<Station, string> = { hand: "", table: "Crafting table", furnace: "Furnace" };

export function hasIngredients(inv: Inventory, recipe: Recipe): boolean {
  return recipe.ingredients.every(i => inv.count(i.id) >= i.count);
}

/** Has the ingredients, and is near the right station (`near` lists the stations in reach). */
export function canCraft(inv: Inventory, recipe: Recipe, near: ReadonlySet<Station> = new Set(["hand"])): boolean {
  return (recipe.station === "hand" || near.has(recipe.station)) && hasIngredients(inv, recipe);
}

/** Craft once. Returns false (and changes nothing) if ingredients, station or space are missing. */
export function craft(inv: Inventory, recipe: Recipe, near: ReadonlySet<Station> = new Set(["hand"])): boolean {
  if (!canCraft(inv, recipe, near)) return false;
  const before = inv.save();
  for (const i of recipe.ingredients) inv.remove(i.id, i.count);
  const left = inv.add(recipe.result.id, recipe.result.count);
  if (left > 0) {
    inv.load(before);
    return false;
  }
  return true;
}
