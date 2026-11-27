import type { Rng } from "../../core/random";
import { Block, blockDef } from "../world/blocks";
import { Item, type ToolInfo, type ToolType } from "./items";

/** Which tool is best for each kind of block. */
const BEST_TOOL: Partial<Record<number, ToolType>> = {
  [Block.Stone]: "pickaxe", [Block.Cobble]: "pickaxe", [Block.Brick]: "pickaxe", [Block.Sandstone]: "pickaxe",
  [Block.Ice]: "pickaxe", [Block.Lantern]: "pickaxe", [Block.CoalOre]: "pickaxe", [Block.IronOre]: "pickaxe",
  [Block.Furnace]: "pickaxe",
  [Block.Wood]: "axe", [Block.PalmWood]: "axe", [Block.Planks]: "axe", [Block.Cactus]: "axe",
  [Block.CraftingTable]: "axe", [Block.Chest]: "axe", [Block.Bed]: "axe",
  [Block.Grass]: "shovel", [Block.Dirt]: "shovel", [Block.Sand]: "shovel", [Block.Snow]: "shovel",
  [Block.SnowyGrass]: "shovel", [Block.Farmland]: "shovel",
};

/** Blocks that only drop when mined with a pickaxe of at least this tier (1 wood, 2 stone, 3 iron). */
const NEEDS_PICKAXE: Partial<Record<number, number>> = {
  [Block.Stone]: 1, [Block.Cobble]: 1, [Block.Brick]: 1, [Block.Sandstone]: 1, [Block.CoalOre]: 1,
  [Block.Furnace]: 1, [Block.IronOre]: 2,
};

export interface MiningInfo {
  seconds: number;
  /** Whether the block drops an item with this tool. */
  drops: boolean;
  /** Whether the tool counts as the right one. */
  effective: boolean;
}

export function miningInfo(blockId: number, tool: ToolInfo | undefined): MiningInfo {
  const def = blockDef(blockId);
  const hardness = def?.hardness ?? 1;
  const best = BEST_TOOL[blockId];
  const effective = !!tool && tool.type === best;
  const tierNeeded = NEEDS_PICKAXE[blockId];
  const drops = tierNeeded === undefined || (effective && tool!.tier >= tierNeeded);
  let seconds = hardness;
  if (effective) seconds /= tool!.speed;
  else if (tierNeeded !== undefined) seconds *= 3.3;
  return { seconds, drops, effective };
}

/** What a mined block leaves behind. `meta` is the block's state (crop growth, sapling kind). */
export function blockDrops(blockId: number, rng: Rng, meta = 0): { id: number; count: number }[] {
  switch (blockId) {
    case Block.Grass:
    case Block.SnowyGrass:
      return rng() < 0.12 ? [{ id: Block.Dirt, count: 1 }, { id: Item.Seeds, count: 1 }] : [{ id: Block.Dirt, count: 1 }];
    case Block.Farmland:
      return [{ id: Block.Dirt, count: 1 }];
    case Block.Stone:
      return [{ id: Block.Cobble, count: 1 }];
    case Block.CoalOre:
      return [{ id: Item.Coal, count: 1 }];
    case Block.Leaves:
    case Block.PineLeaves: {
      // Leaves sometimes drop a sapling, an apple, or a stick.
      const roll = rng();
      if (roll < 0.07) return [{ id: blockId === Block.PineLeaves ? Item.PineSapling : Block.Sapling, count: 1 }];
      if (roll < 0.17 && blockId === Block.Leaves) return [{ id: Item.Apple, count: 1 }];
      if (roll < 0.24) return [{ id: Item.Stick, count: 1 }];
      return [];
    }
    case Block.Wheat:
      return meta >= 3
        ? [{ id: Item.Wheat, count: 1 }, { id: Item.Seeds, count: 1 + Math.floor(rng() * 2) }]
        : [{ id: Item.Seeds, count: 1 }];
    case Block.Sapling:
      return [{ id: meta === 1 ? Item.PineSapling : Block.Sapling, count: 1 }];
    case Block.Glass:
    case Block.Ice:
    case Block.Water:
    case Block.Bedrock:
      return [];
    default:
      return [{ id: blockId, count: 1 }];
  }
}
