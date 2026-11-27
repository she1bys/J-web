import { BLOCKS, Block, type BlockId } from "../world/blocks";

export type ToolType = "pickaxe" | "axe" | "shovel" | "hoe" | "sword";

export interface ToolInfo {
  type: ToolType;
  /** 1 = wood, 2 = stone, 3 = iron */
  tier: 1 | 2 | 3;
  /** How many blocks it can mine before breaking. */
  durability: number;
  /** Mining speed multiplier on matching blocks. */
  speed: number;
}

/** Anything that can sit in an inventory slot: every block, plus tools, food and materials. */
export interface ItemDef {
  id: number;
  /** snake_case name used by commands, e.g. "stone_pickaxe" */
  key: string;
  name: string;
  maxStack: number;
  /** Set when the item places a block. */
  block?: BlockId;
  tool?: ToolInfo;
  /** Hunger points restored when eaten. */
  food?: number;
  /** Damage dealt when hitting a creature (fists do 1). */
  damage?: number;
  /** Planting: the block (and meta) this item places on farmland or soil, e.g. seeds → wheat. */
  plants?: { block: BlockId; meta: number; on: readonly BlockId[] };
}

/** Non-block items. Block items share their block's id (1–99). */
export const Item = {
  Stick: 100,
  Apple: 101,
  WoodenPickaxe: 102,
  StonePickaxe: 103,
  WoodenAxe: 104,
  StoneAxe: 105,
  WoodenShovel: 106,
  StoneShovel: 107,
  Coal: 108,
  IronIngot: 109,
  IronPickaxe: 110,
  IronAxe: 111,
  IronShovel: 112,
  WoodenSword: 113,
  StoneSword: 114,
  IronSword: 115,
  WoodenHoe: 116,
  StoneHoe: 117,
  IronHoe: 118,
  Seeds: 119,
  Wheat: 120,
  Bread: 121,
  RawMeat: 122,
  CookedMeat: 123,
  Fluff: 124,
  PineSapling: 125,
} as const;

const snake = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const tool = (type: ToolType, tier: 1 | 2 | 3): ToolInfo => ({
  type,
  tier,
  durability: [0, 60, 132, 250][tier],
  speed: [0, 2.5, 4, 6][tier],
});

const SOIL = [Block.Grass, Block.Dirt, Block.SnowyGrass] as const;

const extra: ItemDef[] = [
  { id: Item.Stick, key: "stick", name: "Stick", maxStack: 64 },
  { id: Item.Apple, key: "apple", name: "Apple", maxStack: 64, food: 4 },
  { id: Item.WoodenPickaxe, key: "wooden_pickaxe", name: "Wooden pickaxe", maxStack: 1, tool: tool("pickaxe", 1) },
  { id: Item.StonePickaxe, key: "stone_pickaxe", name: "Stone pickaxe", maxStack: 1, tool: tool("pickaxe", 2) },
  { id: Item.WoodenAxe, key: "wooden_axe", name: "Wooden axe", maxStack: 1, tool: tool("axe", 1) },
  { id: Item.StoneAxe, key: "stone_axe", name: "Stone axe", maxStack: 1, tool: tool("axe", 2) },
  { id: Item.WoodenShovel, key: "wooden_shovel", name: "Wooden shovel", maxStack: 1, tool: tool("shovel", 1) },
  { id: Item.StoneShovel, key: "stone_shovel", name: "Stone shovel", maxStack: 1, tool: tool("shovel", 2) },
  { id: Item.Coal, key: "coal", name: "Coal", maxStack: 64 },
  { id: Item.IronIngot, key: "iron_ingot", name: "Iron ingot", maxStack: 64 },
  { id: Item.IronPickaxe, key: "iron_pickaxe", name: "Iron pickaxe", maxStack: 1, tool: tool("pickaxe", 3) },
  { id: Item.IronAxe, key: "iron_axe", name: "Iron axe", maxStack: 1, tool: tool("axe", 3) },
  { id: Item.IronShovel, key: "iron_shovel", name: "Iron shovel", maxStack: 1, tool: tool("shovel", 3) },
  { id: Item.WoodenSword, key: "wooden_sword", name: "Wooden sword", maxStack: 1, tool: tool("sword", 1), damage: 4 },
  { id: Item.StoneSword, key: "stone_sword", name: "Stone sword", maxStack: 1, tool: tool("sword", 2), damage: 5 },
  { id: Item.IronSword, key: "iron_sword", name: "Iron sword", maxStack: 1, tool: tool("sword", 3), damage: 7 },
  { id: Item.WoodenHoe, key: "wooden_hoe", name: "Wooden hoe", maxStack: 1, tool: tool("hoe", 1) },
  { id: Item.StoneHoe, key: "stone_hoe", name: "Stone hoe", maxStack: 1, tool: tool("hoe", 2) },
  { id: Item.IronHoe, key: "iron_hoe", name: "Iron hoe", maxStack: 1, tool: tool("hoe", 3) },
  { id: Item.Seeds, key: "seeds", name: "Seeds", maxStack: 64, plants: { block: Block.Wheat, meta: 0, on: [Block.Farmland] } },
  { id: Item.Wheat, key: "wheat", name: "Wheat", maxStack: 64 },
  { id: Item.Bread, key: "bread", name: "Bread", maxStack: 64, food: 6 },
  { id: Item.RawMeat, key: "raw_meat", name: "Raw meat", maxStack: 64, food: 2 },
  { id: Item.CookedMeat, key: "cooked_meat", name: "Cooked meat", maxStack: 64, food: 8 },
  { id: Item.Fluff, key: "fluff", name: "Fluff", maxStack: 64 },
  { id: Item.PineSapling, key: "pine_sapling", name: "Pine sapling", maxStack: 64, plants: { block: Block.Sapling, meta: 1, on: SOIL } },
];

const table = new Map<number, ItemDef>();
for (const b of BLOCKS) {
  if (!b || b.id === Block.Air) continue;
  table.set(b.id, { id: b.id, key: snake(b.name), name: b.name, maxStack: 64, block: b.id });
}
for (const it of extra) table.set(it.id, it);
// The sapling block item plants an oak sapling on soil.
table.set(Block.Sapling, { ...table.get(Block.Sapling)!, block: undefined, plants: { block: Block.Sapling, meta: 0, on: SOIL } });
// Wheat crops are obtained as seeds and wheat items, not as a placeable block.
table.delete(Block.Wheat);

export const ITEMS: readonly ItemDef[] = [...table.values()];

export const itemDef = (id: number): ItemDef | undefined => table.get(id);

export const maxStack = (id: number): number => table.get(id)?.maxStack ?? 64;

/** Find an item by command name: "stone_pickaxe", "stone pickaxe", "Stone Pickaxe" or its number. */
export function findItem(name: string): ItemDef | undefined {
  const n = name.trim();
  if (/^\d+$/.test(n)) return table.get(Number(n));
  const k = snake(n);
  return ITEMS.find(i => i.key === k) ?? ITEMS.find(i => i.key === `${k}s`) ?? ITEMS.find(i => `${i.key}s` === k);
}

export type ItemCategory = "block" | "tool" | "food" | "material";

export function itemCategory(def: ItemDef): ItemCategory {
  if (def.tool) return "tool";
  if (def.food !== undefined) return "food";
  if (def.block !== undefined) return "block";
  return "material";
}

const TIER = ["", "Wooden", "Stone", "Iron"];

/** One short line about an item, for the inventory's details card. */
export function describeItem(def: ItemDef, dur?: number): string {
  if (def.tool) {
    const t = def.tool;
    const uses = `${dur ?? t.durability}/${t.durability} uses`;
    if (t.type === "sword") return `${TIER[t.tier]} sword · ${def.damage} damage · ${uses}`;
    if (t.type === "hoe") return `${TIER[t.tier]} hoe · turns grass and dirt into farmland · ${uses}`;
    const what = t.type === "pickaxe" ? (t.tier >= 2 ? "stone, ores and iron ore" : "stone, coal and brick") : t.type === "axe" ? "wood" : "dirt, sand and snow";
    return `${TIER[t.tier]} ${t.type} · mines ${what} faster · ${uses}`;
  }
  if (def.plants) return def.plants.block === Block.Wheat ? "Plant on farmland; grows into wheat" : "Plant on grass or dirt; grows into a tree";
  if (def.food !== undefined) return `Food · restores ${def.food / 2} hunger`;
  if (def.block !== undefined) {
    const b = BLOCKS[def.block];
    if (b?.light) return "Block · gives off light";
    if (def.block === Block.Chest) return "Block · stores 27 stacks";
    if (def.block === Block.CraftingTable) return "Block · stand near it for more recipes";
    if (def.block === Block.Furnace) return "Block · stand near it to smelt and cook";
    if (def.block === Block.Bed) return "Block · sleep through the night, set your spawn";
    return "Block · tap USE to place";
  }
  return "Crafting material";
}
