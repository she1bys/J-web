import { ITEMS, describeItem, itemCategory, itemDef, maxStack, type ItemCategory } from "../items/items";
import { iconElement } from "../items/itemIcons";
import { Inventory, type ItemStack } from "../items/Inventory";
import { RECIPES, STATION_NAMES, canCraft, craft, hasIngredients, type Recipe, type Station } from "../items/recipes";
import type { GameMode } from "../modes";
import { fillSlot } from "./Hud";

export type InventorySound = "click" | "pickup" | "drop" | "craft" | "open" | "close" | "error";

type CreativeFilter = "all" | ItemCategory;
const FILTERS: [CreativeFilter, string][] = [
  ["all", "All"],
  ["block", "Blocks"],
  ["tool", "Tools"],
  ["food", "Food"],
  ["material", "Materials"],
];

/**
 * The inventory: an item details card, backpack and hotbar on the left; crafting (survival)
 * or every item with search and categories (creative) on the right.
 *
 * Works the same with touch and mouse: tap a slot to pick its stack up, tap another to put it
 * down, merge or swap. Double-tap moves a stack between hotbar and backpack.
 * Mouse extras: right-click takes half / places one, shift-click quick-moves,
 * and hovering a slot then pressing 1–9 swaps it with that hotbar slot.
 */
export class InventoryScreen {
  private root: HTMLElement;
  private slotEls: HTMLButtonElement[] = [];
  private handEl: HTMLElement;
  private float: HTMLElement;
  private tip: HTMLElement;
  private info: HTMLElement;
  private side: HTMLElement;
  private hand: ItemStack | null = null;
  /** Slot the held stack came from (for double-tap quick move). */
  private handFrom = -1;
  private lastTap: { slot: number; time: number; inv: Inventory | null } = { slot: -1, time: 0, inv: null };
  private hovered = -1;
  private focusStack: ItemStack | null = null;
  private selected = 0;
  private mode: GameMode = "survival";
  private filter: CreativeFilter = "all";
  private search = "";
  private onlyCraftable = false;
  /** An open chest, shown in place of crafting. */
  private chest: Inventory | null = null;
  private chestEls: HTMLButtonElement[] = [];
  /** Crafting stations in reach (hand, table, furnace). */
  private stations = new Set<Station>(["hand"]);
  /** Which container the held stack came from. */
  private handFromInv: Inventory | null = null;
  private unsub: () => void;
  private unsubChest: (() => void) | null = null;
  isOpen = false;

  constructor(
    parent: HTMLElement,
    private inv: Inventory,
    private onClose: () => void,
    /** Items that couldn't go back into the inventory on close are dropped. */
    private onDrop: (stack: ItemStack) => void,
    private onSound: (kind: InventorySound) => void,
    /** Something was crafted (for achievements). */
    private onCrafted: (id: number, count: number) => void = () => {},
  ) {
    this.root = document.createElement("div");
    this.root.className = "inv";
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="inv-panel" role="dialog" aria-label="Inventory">
        <header class="inv-head">
          <h2 class="inv-title">Inventory</h2>
          <span class="inv-mode"></span>
          <button class="inv-x" type="button" aria-label="Close">✕</button>
        </header>
        <div class="inv-main">
          <section class="inv-col inv-left">
            <div class="inv-info"></div>
            <div class="inv-label">Backpack</div>
            <div class="inv-grid inv-pack"></div>
            <div class="inv-label">Hotbar</div>
            <div class="inv-grid inv-bar"></div>
            <div class="inv-actions">
              <div class="inv-hand" title="Holding"><div class="inv-slot hand"></div><span>Holding</span></div>
              <button class="inv-btn inv-sort" type="button">Sort</button>
              <button class="inv-btn inv-trash" type="button">Trash</button>
            </div>
          </section>
          <section class="inv-col inv-side"></section>
        </div>
      </div>
      <div class="inv-float" hidden></div>
      <div class="inv-tip" hidden></div>`;
    parent.appendChild(this.root);
    const $ = <T extends HTMLElement>(s: string) => this.root.querySelector<T>(s)!;
    this.handEl = $(".inv-slot.hand");
    this.float = $(".inv-float");
    this.tip = $(".inv-tip");
    this.info = $(".inv-info");
    this.side = $(".inv-side");

    for (let i = 0; i < Inventory.SIZE; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "inv-slot";
      b.addEventListener("pointerdown", e => this.onSlot(e, i));
      b.addEventListener("pointerenter", e => this.hover(e, i));
      b.addEventListener("pointerleave", () => this.hover(null, -1));
      b.addEventListener("contextmenu", e => e.preventDefault());
      (i < Inventory.HOTBAR ? $(".inv-bar") : $(".inv-pack")).appendChild(b);
      this.slotEls.push(b);
    }
    $(".inv-x").addEventListener("click", () => this.close());
    $(".inv-sort").addEventListener("click", () => {
      this.inv.sort();
      this.onSound("click");
    });
    $(".inv-trash").addEventListener("pointerdown", e => {
      e.preventDefault();
      if (!this.hand) return this.onSound("error");
      this.hand = null;
      this.onSound("drop");
      this.render();
    });
    // Tap the dimmed background to close
    this.root.addEventListener("pointerdown", e => {
      if (e.target === this.root) this.close();
    });
    this.root.addEventListener("pointermove", e => {
      if (e.pointerType !== "mouse") return;
      const t = `translate(${e.clientX}px, ${e.clientY}px)`;
      this.float.style.transform = t;
      this.tip.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 16}px)`;
    });
    this.unsub = inv.onChange(() => this.isOpen && this.render());
  }

  open(mode: GameMode, selected: number, stations: Set<Station> = new Set(["hand"]), chest?: Inventory): void {
    this.mode = mode;
    this.selected = selected;
    this.stations = stations;
    this.chest = chest ?? null;
    this.unsubChest?.();
    this.unsubChest = chest ? chest.onChange(() => this.isOpen && this.render()) : null;
    this.isOpen = true;
    this.root.hidden = false;
    this.root.querySelector(".inv-mode")!.textContent = this.chest ? "Chest" : mode === "creative" ? "Creative" : "Survival";
    this.focusStack = this.inv.get(selected);
    this.buildSide();
    this.render();
    this.onSound("open");
    addEventListener("keydown", this.onKey);
  }

  close(): void {
    if (!this.isOpen) return;
    // Put whatever is being held back, or drop it if there's no room.
    if (this.hand) {
      const left = this.inv.add(this.hand.id, this.hand.count, this.hand.dur);
      if (left > 0) this.onDrop({ ...this.hand, count: left });
      this.hand = null;
    }
    this.isOpen = false;
    this.unsubChest?.();
    this.unsubChest = null;
    this.chest = null;
    this.root.hidden = true;
    this.tip.hidden = true;
    removeEventListener("keydown", this.onKey);
    this.onSound("close");
    this.onClose();
  }

  private onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest?.("input")) {
      if (e.code === "Escape") (e.target as HTMLInputElement).blur();
      return;
    }
    if (e.code === "KeyE" || e.code === "Escape") {
      e.preventDefault();
      this.close();
    } else if (/^Digit[1-9]$/.test(e.code) && this.hovered >= 0) {
      // Swap the hovered slot with that hotbar slot
      const target = Number(e.code.slice(5)) - 1;
      const a = this.inv.get(this.hovered);
      const b = this.inv.get(target);
      this.inv.set(target, a);
      this.inv.set(this.hovered, b);
      this.onSound("click");
    }
  };

  private hover(e: PointerEvent | null, i: number): void {
    if (e && e.pointerType !== "mouse") return;
    this.hovered = i;
    const s = i >= 0 ? this.inv.get(i) : null;
    const def = s ? itemDef(s.id) : undefined;
    this.tip.hidden = !def;
    if (def) {
      this.tip.textContent = def.name;
      this.focusStack = s;
      this.renderInfo();
    }
  }

  private onSlot(e: PointerEvent, i: number, inv: Inventory = this.inv): void {
    e.preventDefault();
    const now = performance.now();
    const double = this.lastTap.slot === i && this.lastTap.inv === inv && now - this.lastTap.time < 320;
    this.lastTap = { slot: i, time: now, inv };
    const slot = inv.get(i);
    const hand = this.hand;

    if (double && hand && this.handFrom === i && this.handFromInv === inv && !slot) {
      // Double-tap: put it back and move it between hotbar and backpack
      inv.set(i, hand);
      this.hand = null;
      this.quickMove(inv, i);
      this.onSound("click");
    } else if (e.shiftKey && !hand) {
      this.quickMove(inv, i);
      this.onSound("click");
    } else if (e.button === 2) {
      // Right click: take half, or place one
      if (!hand && slot) {
        const half = Math.ceil(slot.count / 2);
        this.hand = { ...slot, count: half };
        this.handFrom = i;
        this.handFromInv = inv;
        inv.set(i, slot.count - half > 0 ? { ...slot, count: slot.count - half } : null);
        this.onSound("pickup");
      } else if (hand && (!slot || (slot.id === hand.id && slot.count < maxStack(slot.id)))) {
        inv.set(i, slot ? { ...slot, count: slot.count + 1 } : { ...hand, count: 1 });
        hand.count--;
        if (hand.count <= 0) this.hand = null;
        this.onSound("drop");
      }
    } else if (!hand) {
      if (slot) {
        this.hand = slot;
        this.handFrom = i;
        this.handFromInv = inv;
        inv.set(i, null);
        this.onSound("pickup");
      }
    } else if (!slot) {
      inv.set(i, hand);
      this.hand = null;
      this.onSound("drop");
    } else if (slot.id === hand.id && maxStack(slot.id) > 1) {
      const n = Math.min(hand.count, maxStack(slot.id) - slot.count);
      inv.set(i, { ...slot, count: slot.count + n });
      hand.count -= n;
      if (hand.count <= 0) this.hand = null;
      this.onSound("drop");
    } else {
      inv.set(i, hand);
      this.hand = slot;
      this.handFrom = i;
        this.handFromInv = inv;
      this.onSound("pickup");
    }
    this.focusStack = this.hand ?? inv.get(i);
    this.render();
  }

  /** Move a stack to the other side: chest ↔ bag when a chest is open, else hotbar ↔ backpack. */
  private quickMove(inv: Inventory, i: number): void {
    const other = this.chest ? (inv === this.chest ? this.inv : this.chest) : null;
    if (!other) return inv.quickMove(i);
    const s = inv.get(i);
    if (!s) return;
    const left = other.add(s.id, s.count, s.dur);
    inv.set(i, left > 0 ? { ...s, count: left } : null);
  }

  /* ---------- Right column ---------- */

  private buildSide(): void {
    this.side.replaceChildren();
    this.chestEls = [];
    if (this.chest) {
      const chest = this.chest;
      this.side.innerHTML = '<div class="inv-side-head"><div class="inv-label">Chest</div></div><div class="inv-grid inv-chest"></div>';
      const grid = this.side.querySelector(".inv-chest")!;
      for (let i = 0; i < chest.size; i++) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "inv-slot";
        b.addEventListener("pointerdown", e => this.onSlot(e, i, chest));
        b.addEventListener("contextmenu", e => e.preventDefault());
        grid.appendChild(b);
        this.chestEls.push(b);
      }
      return;
    }
    if (this.mode === "creative") {
      this.side.innerHTML = `
        <div class="inv-side-head">
          <div class="inv-label">All items</div>
          <input class="inv-search" type="search" placeholder="Search" autocomplete="off" spellcheck="false" aria-label="Search items">
        </div>
        <div class="inv-chips"></div>
        <div class="inv-grid inv-palette"></div>`;
      const chips = this.side.querySelector(".inv-chips")!;
      for (const [key, label] of FILTERS) {
        const c = document.createElement("button");
        c.type = "button";
        c.className = "inv-chip";
        c.textContent = label;
        c.dataset.key = key;
        c.addEventListener("click", () => {
          this.filter = key;
          this.onSound("click");
          this.renderPalette();
        });
        chips.appendChild(c);
      }
      const search = this.side.querySelector<HTMLInputElement>(".inv-search")!;
      search.value = this.search;
      search.addEventListener("input", () => {
        this.search = search.value;
        this.renderPalette();
      });
      search.addEventListener("keydown", e => e.stopPropagation());
      this.renderPalette();
    } else {
      this.side.innerHTML = `
        <div class="inv-side-head">
          <div class="inv-label">Crafting <span class="inv-count"></span></div>
          <div class="inv-toggle" role="group" aria-label="Show">
            <button type="button" data-v="all">All</button><button type="button" data-v="ready">Ready</button>
          </div>
        </div>
        <div class="inv-recipes"></div>`;
      this.side.querySelectorAll<HTMLButtonElement>(".inv-toggle button").forEach(b =>
        b.addEventListener("click", () => {
          this.onlyCraftable = b.dataset.v === "ready";
          this.onSound("click");
          this.renderRecipes();
        }),
      );
    }
  }

  private renderPalette(): void {
    const grid = this.side.querySelector(".inv-palette");
    if (!grid) return;
    this.side.querySelectorAll<HTMLElement>(".inv-chip").forEach(c => c.classList.toggle("on", c.dataset.key === this.filter));
    const q = this.search.trim().toLowerCase();
    grid.replaceChildren();
    const items = ITEMS.filter(it => (this.filter === "all" || itemCategory(it) === this.filter) && (!q || it.name.toLowerCase().includes(q)));
    for (const it of items) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "inv-slot";
      b.setAttribute("aria-label", it.name);
      b.appendChild(iconElement(it.id));
      b.addEventListener("pointerdown", e => {
        e.preventDefault();
        const stack = { id: it.id, count: it.maxStack, ...(it.tool ? { dur: it.tool.durability } : {}) };
        if (e.shiftKey) this.inv.add(it.id, it.maxStack);
        else {
          this.hand = stack;
          this.handFrom = -1;
        }
        this.focusStack = stack;
        this.onSound("pickup");
        this.render();
      });
      b.addEventListener("pointerenter", e => {
        if (e.pointerType !== "mouse") return;
        this.tip.textContent = it.name;
        this.tip.hidden = false;
      });
      b.addEventListener("pointerleave", () => (this.tip.hidden = true));
      grid.appendChild(b);
    }
    if (!items.length) grid.insertAdjacentHTML("beforeend", '<p class="inv-empty">No items match</p>');
  }

  private renderRecipes(): void {
    const list = this.side.querySelector(".inv-recipes");
    if (!list) return;
    this.side.querySelectorAll<HTMLElement>(".inv-toggle button").forEach(b =>
      b.classList.toggle("on", (b.dataset.v === "ready") === this.onlyCraftable),
    );
    // Some items have more than one recipe (planks from either kind of wood): show one card per
    // item, preferring a recipe you can make right now.
    const best = new Map<number, Recipe>();
    for (const r of RECIPES) {
      const cur = best.get(r.result.id);
      if (!cur || (!this.can(cur) && this.can(r))) best.set(r.result.id, r);
    }
    const unique = [...best.values()];
    const ready = unique.filter(r => this.can(r));
    this.side.querySelector(".inv-count")!.textContent = ready.length ? `${ready.length} ready` : "";
    // Ready first, then ones you could make at a station you're not near, then the rest
    const rank = (r: Recipe) => (this.can(r) ? 2 : hasIngredients(this.inv, r) ? 1 : 0);
    const shown = this.onlyCraftable ? ready : unique.sort((a, b) => rank(b) - rank(a));
    list.replaceChildren(...shown.map(r => this.recipeCard(r)));
    if (!shown.length) list.insertAdjacentHTML("beforeend", '<p class="inv-empty">Nothing to craft yet. Gather wood from trees to start.</p>');
  }

  private can(r: Recipe): boolean {
    return canCraft(this.inv, r, this.stations);
  }

  private recipeCard(r: Recipe): HTMLElement {
    const ok = this.can(r);
    const missingStation = r.station !== "hand" && !this.stations.has(r.station);
    const def = itemDef(r.result.id);
    const card = document.createElement("div");
    card.className = `inv-recipe${ok ? "" : " off"}`;

    const out = document.createElement("div");
    out.className = "r-icon";
    out.appendChild(iconElement(r.result.id));
    if (r.result.count > 1) out.insertAdjacentHTML("beforeend", `<span class="r-qty">${r.result.count}</span>`);

    const body = document.createElement("div");
    body.className = "r-body";
    const name = document.createElement("div");
    name.className = "r-name";
    name.textContent = def?.name ?? "";
    const needs = document.createElement("div");
    needs.className = "r-needs";
    for (const i of r.ingredients) {
      const have = this.inv.count(i.id);
      const chip = document.createElement("span");
      chip.className = `r-need${have >= i.count ? "" : " short"}`;
      chip.title = itemDef(i.id)?.name ?? "";
      chip.appendChild(iconElement(i.id));
      chip.insertAdjacentHTML("beforeend", `<b>${Math.min(have, 999)}/${i.count}</b>`);
      needs.appendChild(chip);
    }
    body.append(name, needs);
    if (r.station !== "hand") {
      const where = document.createElement("div");
      where.className = `r-station${missingStation ? " missing" : ""}`;
      where.textContent = missingStation ? `Needs a ${STATION_NAMES[r.station].toLowerCase()} nearby` : STATION_NAMES[r.station];
      body.appendChild(where);
    }

    const actions = document.createElement("div");
    actions.className = "r-actions";
    const one = document.createElement("button");
    one.type = "button";
    one.className = "r-btn";
    one.textContent = "Craft";
    one.disabled = !ok;
    const max = document.createElement("button");
    max.type = "button";
    max.className = "r-btn r-max";
    max.textContent = "Max";
    max.disabled = !ok;
    const make = (times: number) => {
      let made = 0;
      while (made < times && craft(this.inv, r, this.stations)) made++;
      this.onSound(made ? "craft" : "error");
      if (made) this.onCrafted(r.result.id, r.result.count * made);
      if (made) this.focusStack = { id: r.result.id, count: r.result.count * made };
      this.renderInfo();
    };
    one.addEventListener("click", () => make(1));
    max.addEventListener("click", () => make(64));
    actions.append(one, max);

    card.append(out, body, actions);
    card.addEventListener("pointerenter", () => {
      this.focusStack = { id: r.result.id, count: r.result.count };
      this.renderInfo();
    });
    return card;
  }

  /* ---------- Left column ---------- */

  private renderInfo(): void {
    const s = this.focusStack;
    const def = s ? itemDef(s.id) : undefined;
    this.info.replaceChildren();
    if (!s || !def) {
      this.info.innerHTML = '<div class="info-empty">Tap an item to see what it is</div>';
      return;
    }
    const icon = document.createElement("div");
    icon.className = "info-icon";
    icon.appendChild(iconElement(def.id));
    const text = document.createElement("div");
    text.className = "info-text";
    const name = document.createElement("div");
    name.className = "info-name";
    name.textContent = def.name;
    const meta = document.createElement("div");
    meta.className = "info-meta";
    meta.textContent = describeItem(def, s.dur);
    text.append(name, meta);
    if (def.tool && s.dur !== undefined) {
      const f = s.dur / def.tool.durability;
      const bar = document.createElement("div");
      bar.className = "info-wear";
      bar.style.setProperty("--wear", `${Math.round(f * 100)}%`);
      bar.style.setProperty("--wear-color", f > 0.5 ? "#36b24a" : f > 0.2 ? "#e0a81e" : "#e04848");
      text.appendChild(bar);
    }
    this.info.append(icon, text);
  }

  private render(): void {
    const chest = this.chest;
    if (chest) this.chestEls.forEach((el, i) => fillSlot(el, chest.get(i)));
    this.slotEls.forEach((el, i) => {
      fillSlot(el, this.inv.get(i));
      el.classList.toggle("selected", i === this.selected);
    });
    fillSlot(this.handEl, this.hand);
    this.handEl.parentElement!.classList.toggle("on", !!this.hand);
    fillSlot(this.float, this.hand);
    this.float.hidden = !this.hand;
    this.renderInfo();
    if (this.mode === "survival" && !this.chest) this.renderRecipes();
  }

  dispose(): void {
    this.unsub();
    removeEventListener("keydown", this.onKey);
    this.root.remove();
  }
}
