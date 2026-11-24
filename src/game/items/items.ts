import { BLOCKS, Block, type BlockId } from "../world/blocks";

export type ToolType = "pickaxe" | "axe" | "shovel";

export interface ToolInfo {
  type: ToolType;
  /** 1 = wood, 2 = stone */
  tier: 1 | 2;
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
} as const;

const snake = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const tool = (type: ToolType, tier: 1 | 2): ToolInfo => ({
  type,
  tier,
  durability: tier === 1 ? 60 : 132,
  speed: tier === 1 ? 2.5 : 4,
});

const extra: ItemDef[] = [
  { id: Item.Stick, key: "stick", name: "Stick", maxStack: 64 },
  { id: Item.Apple, key: "apple", name: "Apple", maxStack: 64, food: 4 },
  { id: Item.WoodenPickaxe, key: "wooden_pickaxe", name: "Wooden pickaxe", maxStack: 1, tool: tool("pickaxe", 1) },
  { id: Item.StonePickaxe, key: "stone_pickaxe", name: "Stone pickaxe", maxStack: 1, tool: tool("pickaxe", 2) },
  { id: Item.WoodenAxe, key: "wooden_axe", name: "Wooden axe", maxStack: 1, tool: tool("axe", 1) },
  { id: Item.StoneAxe, key: "stone_axe", name: "Stone axe", maxStack: 1, tool: tool("axe", 2) },
  { id: Item.WoodenShovel, key: "wooden_shovel", name: "Wooden shovel", maxStack: 1, tool: tool("shovel", 1) },
  { id: Item.StoneShovel, key: "stone_shovel", name: "Stone shovel", maxStack: 1, tool: tool("shovel", 2) },
];

const table = new Map<number, ItemDef>();
for (const b of BLOCKS) {
  if (!b || b.id === Block.Air) continue;
  table.set(b.id, { id: b.id, key: snake(b.name), name: b.name, maxStack: 64, block: b.id });
}
for (const it of extra) table.set(it.id, it);

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
