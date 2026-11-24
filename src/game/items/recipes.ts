import { Block } from "../world/blocks";
import { Item } from "./items";
import type { Inventory } from "./Inventory";

export interface Ingredient {
  id: number;
  count: number;
}

export interface Recipe {
  result: Ingredient;
  ingredients: Ingredient[];
}

const r = (id: number, count: number, ...ingredients: [number, number][]): Recipe => ({
  result: { id, count },
  ingredients: ingredients.map(([i, c]) => ({ id: i, count: c })),
});

/** Everything that can be crafted from the inventory. No crafting table needed. */
export const RECIPES: readonly Recipe[] = [
  r(Block.Planks, 4, [Block.Wood, 1]),
  r(Block.Planks, 4, [Block.PalmWood, 1]),
  r(Item.Stick, 4, [Block.Planks, 2]),
  r(Item.WoodenPickaxe, 1, [Block.Planks, 3], [Item.Stick, 2]),
  r(Item.WoodenAxe, 1, [Block.Planks, 3], [Item.Stick, 2]),
  r(Item.WoodenShovel, 1, [Block.Planks, 1], [Item.Stick, 2]),
  r(Item.StonePickaxe, 1, [Block.Cobble, 3], [Item.Stick, 2]),
  r(Item.StoneAxe, 1, [Block.Cobble, 3], [Item.Stick, 2]),
  r(Item.StoneShovel, 1, [Block.Cobble, 1], [Item.Stick, 2]),
  r(Block.Stone, 1, [Block.Cobble, 1], [Block.Planks, 1]),
  r(Block.Glass, 1, [Block.Sand, 1], [Block.Planks, 1]),
  r(Block.Sandstone, 1, [Block.Sand, 4]),
  r(Block.Brick, 2, [Block.Cobble, 2], [Block.Sand, 2]),
  r(Block.Ice, 1, [Block.Snow, 4]),
  r(Block.Lantern, 1, [Block.Glass, 1], [Item.Stick, 1], [Block.Planks, 1]),
  r(Block.Rose, 1, [Item.Apple, 1], [Block.Glass, 1]),
];

export function canCraft(inv: Inventory, recipe: Recipe): boolean {
  return recipe.ingredients.every(i => inv.count(i.id) >= i.count);
}

/** Craft once. Returns false (and changes nothing) if ingredients or space are missing. */
export function craft(inv: Inventory, recipe: Recipe): boolean {
  if (!canCraft(inv, recipe)) return false;
  // Check there is room for the result once the ingredients are used up.
  const before = inv.save();
  for (const i of recipe.ingredients) inv.remove(i.id, i.count);
  const left = inv.add(recipe.result.id, recipe.result.count);
  if (left > 0) {
    inv.load(before);
    return false;
  }
  return true;
}
