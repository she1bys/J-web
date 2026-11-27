import { maxStack, itemDef } from "./items";

export interface ItemStack {
  id: number;
  count: number;
  /** Uses left, for tools. */
  dur?: number;
}

/** Flat save format: one entry per slot, null for empty. */
export type SavedInventory = ([id: number, count: number, dur?: number] | null)[];

/**
 * 36 slots: 0–8 are the hotbar, 9–35 the backpack.
 * Adding fills existing stacks first, then empty slots, hotbar first.
 */
export class Inventory {
  static readonly SIZE = 36;
  static readonly HOTBAR = 9;
  readonly slots: (ItemStack | null)[];
  private listeners = new Set<() => void>();

  /** 36 for the player (with a hotbar); 27 for a chest. */
  constructor(readonly size = Inventory.SIZE) {
    this.slots = Array(size).fill(null);
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  changed(): void {
    this.listeners.forEach(f => f());
  }

  get(i: number): ItemStack | null {
    return this.slots[i] ?? null;
  }

  set(i: number, stack: ItemStack | null): void {
    this.slots[i] = stack && stack.count > 0 ? stack : null;
    this.changed();
  }

  /** Add items; returns how many didn't fit. */
  add(id: number, count: number, dur?: number): number {
    const max = maxStack(id);
    let left = count;
    if (max > 1) {
      for (let i = 0; i < this.size && left > 0; i++) {
        const s = this.slots[i];
        if (s && s.id === id && s.count < max) {
          const n = Math.min(left, max - s.count);
          s.count += n;
          left -= n;
        }
      }
    }
    for (let i = 0; i < this.size && left > 0; i++) {
      if (this.slots[i]) continue;
      const n = Math.min(left, max);
      const tool = itemDef(id)?.tool;
      this.slots[i] = { id, count: n, ...(tool ? { dur: dur ?? tool.durability } : {}) };
      left -= n;
    }
    if (left !== count) this.changed();
    return left;
  }

  /** How many of an item there are in total. */
  count(id: number): number {
    return this.slots.reduce((n, s) => n + (s?.id === id ? s.count : 0), 0);
  }

  /** Room for how many more of an item. */
  space(id: number): number {
    const max = maxStack(id);
    return this.slots.reduce((n, s) => n + (!s ? max : s.id === id ? max - s.count : 0), 0);
  }

  /** Remove `n` of an item (backpack first). Returns false and changes nothing if there aren't enough. */
  remove(id: number, n: number): boolean {
    if (this.count(id) < n) return false;
    for (let i = this.size - 1; i >= 0 && n > 0; i--) {
      const s = this.slots[i];
      if (s?.id !== id) continue;
      const take = Math.min(n, s.count);
      s.count -= take;
      n -= take;
      if (s.count <= 0) this.slots[i] = null;
    }
    this.changed();
    return true;
  }

  /** Take one item from a slot (placing a block, eating). */
  takeOne(i: number): ItemStack | null {
    const s = this.slots[i];
    if (!s) return null;
    s.count--;
    if (s.count <= 0) this.slots[i] = null;
    this.changed();
    return { id: s.id, count: 1 };
  }

  /** Wear a tool down by one use. Returns true if it broke. */
  wear(i: number): boolean {
    const s = this.slots[i];
    if (!s || s.dur === undefined) return false;
    s.dur--;
    const broke = s.dur <= 0;
    if (broke) this.slots[i] = null;
    this.changed();
    return broke;
  }

  /** Move a whole stack between the hotbar and the backpack (shift-click). */
  quickMove(i: number): void {
    const s = this.slots[i];
    if (!s) return;
    const toHotbar = i >= Inventory.HOTBAR;
    const [from, to] = toHotbar ? [0, Inventory.HOTBAR] : [Inventory.HOTBAR, Inventory.SIZE];
    this.slots[i] = null;
    const max = maxStack(s.id);
    for (let k = from; k < to && s.count > 0; k++) {
      const t = this.slots[k];
      if (t && t.id === s.id && max > 1 && t.count < max) {
        const n = Math.min(s.count, max - t.count);
        t.count += n;
        s.count -= n;
      }
    }
    for (let k = from; k < to && s.count > 0; k++) {
      if (!this.slots[k]) {
        this.slots[k] = { ...s };
        s.count = 0;
      }
    }
    if (s.count > 0) this.slots[i] = s;
    this.changed();
  }

  /** Merge partial stacks and order the backpack by item (the hotbar is left as it is). */
  sort(): void {
    const items: ItemStack[] = [];
    for (let i = Inventory.HOTBAR; i < Inventory.SIZE; i++) {
      const s = this.slots[i];
      if (s) items.push({ ...s });
      this.slots[i] = null;
    }
    items.sort((a, b) => a.id - b.id || (b.dur ?? 0) - (a.dur ?? 0));
    let k = Inventory.HOTBAR;
    for (const s of items) {
      const max = maxStack(s.id);
      const prev = k > Inventory.HOTBAR ? this.slots[k - 1] : null;
      if (prev && prev.id === s.id && max > 1 && prev.count < max) {
        const n = Math.min(s.count, max - prev.count);
        prev.count += n;
        s.count -= n;
      }
      if (s.count > 0) this.slots[k++] = s;
    }
    this.changed();
  }

  clear(): void {
    this.slots.fill(null);
    this.changed();
  }

  isEmpty(): boolean {
    return this.slots.every(s => !s);
  }

  save(): SavedInventory {
    return this.slots.map(s => (s ? (s.dur !== undefined ? [s.id, s.count, s.dur] : [s.id, s.count]) : null));
  }

  load(data: SavedInventory | undefined): void {
    this.slots.fill(null);
    data?.slice(0, this.size).forEach((e, i) => {
      if (e && itemDef(e[0]) && e[1] > 0) this.slots[i] = { id: e[0], count: e[1], ...(e[2] !== undefined ? { dur: e[2] } : {}) };
    });
    this.changed();
  }
}
