import { Block } from "../world/blocks";
import { Item } from "../items/items";
import type { Inventory } from "../items/Inventory";

export interface TipContext {
  inv: Inventory;
  got: ReadonlySet<string>;
  touch: boolean;
  time: number;
}

interface Tip {
  text: (touch: boolean) => string;
  /** The step is done (move on to the next tip). */
  done: (c: TipContext) => boolean;
}

const hasAny = (inv: Inventory, ids: number[]) => ids.some(id => inv.count(id) > 0);
const PICKS = [Item.WoodenPickaxe, Item.StonePickaxe, Item.IronPickaxe];

/** Getting started in survival, one step at a time. */
export const SURVIVAL_TIPS: readonly Tip[] = [
  {
    text: t => (t ? "Hold MINE while looking at a tree to collect wood" : "Hold left click on a tree to collect wood"),
    done: c => c.got.has("wood") || hasAny(c.inv, [Block.Wood, Block.PalmWood, Block.Planks]),
  },
  {
    text: t => `Open your bag (${t ? "BAG" : "E"}) and craft planks, then a crafting table`,
    done: c => c.got.has("table") || hasAny(c.inv, [Block.CraftingTable]),
  },
  {
    text: t => `Place the table (${t ? "USE" : "right click"}), then craft sticks and a wooden pickaxe next to it`,
    done: c => c.got.has("pickaxe") || hasAny(c.inv, PICKS),
  },
  {
    text: () => "Mine stone for cobblestone, then make stone tools and a furnace",
    done: c => c.got.has("stone") || hasAny(c.inv, [Item.StonePickaxe, Item.IronPickaxe]),
  },
  {
    text: () => "Find coal in caves and cliffs. Coal and a stick make 4 torches",
    done: c => c.got.has("torch") || hasAny(c.inv, [Block.Torch]),
  },
  {
    text: () => "Nights are dark: build a shelter and light it, or sleep in a bed (fluff from animals)",
    done: c => c.got.has("night") || c.got.has("sleep"),
  },
];

export const CREATIVE_TIPS: readonly Tip[] = [
  {
    text: t => (t ? "Tap BAG for every block · double-tap JUMP to fly" : "Press E for every block · double-tap Space to fly"),
    done: c => c.time < 0, // shown until dismissed or the world is left
  },
];
