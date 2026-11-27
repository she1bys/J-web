import { Block } from "../world/blocks";
import { Item } from "../items/items";

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  /** Only possible in survival (counts like hunger or nights don't apply in creative). */
  survival?: boolean;
}

/** Every achievement, in roughly the order you'll earn them. Names are this game's own. */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: "wood", name: "First Harvest", description: "Collect wood from a tree" },
  { id: "table", name: "Workbench Ready", description: "Make a crafting table" },
  { id: "pickaxe", name: "Pick It Up", description: "Make a pickaxe" },
  { id: "stone", name: "Rock Solid", description: "Make a stone pickaxe" },
  { id: "torch", name: "Little Light", description: "Place a torch" },
  { id: "deep", name: "Into the Deep", description: "Go 15 blocks below the surface" },
  { id: "iron", name: "Forged in Fire", description: "Smelt an iron ingot" },
  { id: "ironpick", name: "Iron Will", description: "Make an iron pickaxe" },
  { id: "harvest", name: "Green Thumb", description: "Harvest ripe wheat" },
  { id: "bread", name: "Fresh from the Oven", description: "Eat bread" },
  { id: "chest", name: "Safekeeping", description: "Store something in a chest" },
  { id: "sleep", name: "Sweet Dreams", description: "Sleep through the night in a bed", survival: true },
  { id: "night", name: "Night Owl", description: "Survive a whole night without dying", survival: true },
  { id: "builder", name: "Home Builder", description: "Place 100 blocks" },
  { id: "wanderer", name: "Wanderer", description: "Walk 1,000 blocks" },
  { id: "hunter", name: "Brave Heart", description: "Defeat a night creature", survival: true },
  { id: "friend", name: "Animal Friend", description: "Feed an animal" },
];

export interface ProgressSave {
  got: string[];
  placed: number;
  walked: number;
  tip: number;
  nightAlive: boolean;
}

/**
 * Watches what the player does and unlocks achievements. The game reports events
 * (crafted, placed, mined, ate…); this decides what they mean.
 */
export class Achievements {
  readonly got = new Set<string>();
  placed = 0;
  walked = 0;
  /** True once a night has started with the player alive; cleared on death. */
  nightAlive = false;

  constructor(
    private onUnlock: (a: AchievementDef) => void,
    save?: Partial<ProgressSave>,
    /** Whether an achievement can be earned right now (e.g. survival-only ones in creative). */
    private allowed: (a: AchievementDef) => boolean = () => true,
  ) {
    save?.got?.forEach(id => this.got.add(id));
    this.placed = save?.placed ?? 0;
    this.walked = save?.walked ?? 0;
    this.nightAlive = save?.nightAlive ?? false;
  }

  unlock(id: string): void {
    if (this.got.has(id)) return;
    const def = ACHIEVEMENTS.find(a => a.id === id);
    if (!def || !this.allowed(def)) return;
    this.got.add(id);
    this.onUnlock(def);
  }

  pickedUp(id: number): void {
    if (id === Block.Wood || id === Block.PalmWood) this.unlock("wood");
  }

  crafted(id: number): void {
    if (id === Block.CraftingTable) this.unlock("table");
    if (id === Item.WoodenPickaxe || id === Item.StonePickaxe || id === Item.IronPickaxe) this.unlock("pickaxe");
    if (id === Item.StonePickaxe) this.unlock("stone");
    if (id === Item.IronIngot) this.unlock("iron");
    if (id === Item.IronPickaxe) this.unlock("ironpick");
  }

  placedBlock(id: number): void {
    if (id === Block.Torch) this.unlock("torch");
    if (++this.placed >= 100) this.unlock("builder");
  }

  mined(id: number, meta: number): void {
    if (id === Block.Wheat && meta >= 3) this.unlock("harvest");
    if (id === Block.Wood || id === Block.PalmWood) this.unlock("wood");
  }

  ate(id: number): void {
    if (id === Item.Bread) this.unlock("bread");
  }

  /** Called every frame with how far the player moved and where they are. */
  moved(distance: number, depthBelowSurface: number): void {
    this.walked += distance;
    if (this.walked >= 1000) this.unlock("wanderer");
    if (depthBelowSurface >= 15) this.unlock("deep");
  }

  /** Track nights: start one alive (time passes dusk), survive to morning. */
  timeOfDay(prev: number, now: number, survival: boolean, alive: boolean): void {
    if (!survival || !alive) return;
    const crossed = (t: number) => (prev < t && now >= t) || (prev > now && (now >= t || prev < t));
    if (crossed(0.55)) this.nightAlive = true;
    if (crossed(0.99) && this.nightAlive) this.unlock("night");
  }

  died(): void {
    this.nightAlive = false;
  }

  save(tip: number): ProgressSave {
    return { got: [...this.got], placed: this.placed, walked: Math.round(this.walked), tip, nightAlive: this.nightAlive };
  }
}
