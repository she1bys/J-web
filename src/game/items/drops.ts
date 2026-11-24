import type { Rng } from "../../core/random";
import { Block, blockDef } from "../world/blocks";
import { Item, type ToolInfo, type ToolType } from "./items";

/** Which tool is best for each kind of block. */
const BEST_TOOL: Partial<Record<number, ToolType>> = {
  [Block.Stone]: "pickaxe", [Block.Cobble]: "pickaxe", [Block.Brick]: "pickaxe", [Block.Sandstone]: "pickaxe",
  [Block.Ice]: "pickaxe", [Block.Lantern]: "pickaxe",
  [Block.Wood]: "axe", [Block.PalmWood]: "axe", [Block.Planks]: "axe", [Block.Cactus]: "axe",
  [Block.Grass]: "shovel", [Block.Dirt]: "shovel", [Block.Sand]: "shovel", [Block.Snow]: "shovel", [Block.SnowyGrass]: "shovel",
};

/** Blocks that only drop anything when mined with a pickaxe. */
const NEEDS_PICKAXE = new Set<number>([Block.Stone, Block.Cobble, Block.Brick, Block.Sandstone]);

export interface MiningInfo {
  seconds: number;
  /** Whether the block drops an item with this tool. */
  drops: boolean;
  /** Whether the tool counts as the right one (wears it down). */
  effective: boolean;
}

export function miningInfo(blockId: number, tool: ToolInfo | undefined): MiningInfo {
  const def = blockDef(blockId);
  const hardness = def?.hardness ?? 1;
  const best = BEST_TOOL[blockId];
  const effective = !!tool && tool.type === best;
  const needs = NEEDS_PICKAXE.has(blockId);
  const drops = !needs || (effective && tool!.type === "pickaxe");
  let seconds = hardness;
  if (effective) seconds /= tool!.speed;
  else if (needs) seconds *= 3.3;
  return { seconds, drops, effective };
}

/** What a mined block leaves behind. */
export function blockDrops(blockId: number, rng: Rng): { id: number; count: number }[] {
  switch (blockId) {
    case Block.Grass:
    case Block.SnowyGrass:
      return [{ id: Block.Dirt, count: 1 }];
    case Block.Stone:
      return [{ id: Block.Cobble, count: 1 }];
    case Block.Leaves:
    case Block.PineLeaves:
      // Leaves sometimes drop an apple, and now and then a stick.
      if (rng() < 0.12) return [{ id: Item.Apple, count: 1 }];
      if (rng() < 0.08) return [{ id: Item.Stick, count: 1 }];
      return [];
    case Block.Glass:
    case Block.Ice:
    case Block.Water:
      return [];
    default:
      return [{ id: blockId, count: 1 }];
  }
}
