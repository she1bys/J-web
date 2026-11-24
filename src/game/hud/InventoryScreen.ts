import { ITEMS, itemDef, maxStack } from "../items/items";
import { iconElement } from "../items/itemIcons";
import { Inventory, type ItemStack } from "../items/Inventory";
import { RECIPES, canCraft, craft, type Recipe } from "../items/recipes";
import type { GameMode } from "../modes";
import { fillSlot } from "./Hud";

/**
 * Inventory, crafting and the creative palette. Works with taps or clicks:
 * tap a slot to pick its stack up ("holding"), tap another to put it down, merge or swap.
 * On a mouse: right-click takes half / places one, shift-click moves between hotbar and backpack.
 */
export class InventoryScreen {
  private root: HTMLElement;
  private grid: HTMLElement;
  private bar: HTMLElement;
  private side: HTMLElement;
  private handEl: HTMLElement;
  private float: HTMLElement;
  private hand: ItemStack | null = null;
  private slotEls: HTMLButtonElement[] = [];
  private mode: GameMode = "survival";
  private unsub: () => void;
  isOpen = false;

  constructor(
    parent: HTMLElement,
    private inv: Inventory,
    private onClose: () => void,
    /** Items that couldn't go back into the inventory on close are dropped. */
    private onDrop: (stack: ItemStack) => void,
    private onSound: (kind: "click" | "craft") => void,
  ) {
    this.root = document.createElement("div");
    this.root.className = "inv";
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="inv-panel" role="dialog" aria-label="Inventory">
        <div class="inv-head"><span class="inv-title">Inventory</span><button class="inv-x" type="button" aria-label="Close">X</button></div>
        <div class="inv-body">
          <div class="inv-left">
            <div class="inv-grid inv-main"></div>
            <div class="inv-grid inv-bar"></div>
            <div class="inv-tools">
              <div class="inv-hand"><span>Holding</span><div class="inv-slot hand"></div></div>
              <button class="inv-trash" type="button">Trash</button>
            </div>
          </div>
          <div class="inv-side"></div>
        </div>
      </div>
      <div class="inv-float"></div>`;
    parent.appendChild(this.root);
    const $ = <T extends HTMLElement>(s: string) => this.root.querySelector<T>(s)!;
    this.grid = $(".inv-main");
    this.bar = $(".inv-bar");
    this.side = $(".inv-side");
    this.handEl = $(".inv-slot.hand");
    this.float = $(".inv-float");

    for (let i = 0; i < Inventory.SIZE; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "inv-slot";
      b.addEventListener("pointerdown", e => this.onSlot(e, i));
      b.addEventListener("contextmenu", e => e.preventDefault());
      (i < Inventory.HOTBAR ? this.bar : this.grid).appendChild(b);
      this.slotEls.push(b);
    }
    $(".inv-x").addEventListener("click", () => this.close());
    $(".inv-trash").addEventListener("pointerdown", e => {
      e.preventDefault();
      if (this.hand) {
        this.hand = null;
        this.onSound("click");
        this.render();
      }
    });
    // Tap outside the panel to close
    this.root.addEventListener("pointerdown", e => {
      if (e.target === this.root) this.close();
    });
    this.root.addEventListener("pointermove", e => {
      if (e.pointerType !== "mouse") return;
      this.float.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    });
    this.unsub = inv.onChange(() => this.isOpen && this.render());
  }

  open(mode: GameMode): void {
    this.mode = mode;
    this.isOpen = true;
    this.root.hidden = false;
    this.root.querySelector(".inv-title")!.textContent = mode === "creative" ? "Creative" : "Inventory";
    this.buildSide();
    this.render();
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
    this.root.hidden = true;
    removeEventListener("keydown", this.onKey);
    this.onClose();
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.code === "KeyE" || e.code === "Escape") {
      e.preventDefault();
      this.close();
    }
  };

  private onSlot(e: PointerEvent, i: number): void {
    e.preventDefault();
    const slot = this.inv.get(i);
    const hand = this.hand;
    if (e.shiftKey && !hand) {
      this.inv.quickMove(i);
    } else if (e.button === 2) {
      // Right click: take half, or place one
      if (!hand && slot) {
        const half = Math.ceil(slot.count / 2);
        this.hand = { ...slot, count: half };
        this.inv.set(i, slot.count - half > 0 ? { ...slot, count: slot.count - half } : null);
      } else if (hand && (!slot || (slot.id === hand.id && slot.count < maxStack(slot.id)))) {
        this.inv.set(i, slot ? { ...slot, count: slot.count + 1 } : { ...hand, count: 1 });
        hand.count--;
        if (hand.count <= 0) this.hand = null;
      }
    } else if (!hand) {
      if (slot) {
        this.hand = slot;
        this.inv.set(i, null);
      }
    } else if (!slot) {
      this.inv.set(i, hand);
      this.hand = null;
    } else if (slot.id === hand.id && maxStack(slot.id) > 1) {
      const n = Math.min(hand.count, maxStack(slot.id) - slot.count);
      this.inv.set(i, { ...slot, count: slot.count + n });
      hand.count -= n;
      if (hand.count <= 0) this.hand = null;
    } else {
      this.inv.set(i, hand);
      this.hand = slot;
    }
    this.onSound("click");
    this.render();
  }

  private buildSide(): void {
    this.side.replaceChildren();
    if (this.mode === "creative") {
      const head = document.createElement("div");
      head.className = "inv-sub";
      head.textContent = "All items";
      const pal = document.createElement("div");
      pal.className = "inv-grid inv-palette";
      for (const it of ITEMS) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "inv-slot";
        b.title = it.name;
        b.appendChild(iconElement(it.id));
        b.addEventListener("pointerdown", e => {
          e.preventDefault();
          if (e.shiftKey) this.inv.add(it.id, it.maxStack);
          else this.hand = { id: it.id, count: it.maxStack, ...(it.tool ? { dur: it.tool.durability } : {}) };
          this.onSound("click");
          this.render();
        });
        pal.appendChild(b);
      }
      this.side.append(head, pal);
    } else {
      const head = document.createElement("div");
      head.className = "inv-sub";
      head.textContent = "Crafting";
      const list = document.createElement("div");
      list.className = "inv-recipes";
      this.side.append(head, list);
    }
  }

  private renderRecipes(): void {
    const list = this.side.querySelector(".inv-recipes");
    if (!list) return;
    list.replaceChildren();
    // Craftable recipes first
    const sorted = [...RECIPES].sort((a, b) => Number(canCraft(this.inv, b)) - Number(canCraft(this.inv, a)));
    for (const r of sorted) list.appendChild(this.recipeRow(r));
  }

  private recipeRow(r: Recipe): HTMLElement {
    const ok = canCraft(this.inv, r);
    const row = document.createElement("button");
    row.type = "button";
    row.className = `inv-recipe${ok ? "" : " no"}`;
    const out = document.createElement("span");
    out.className = "r-out";
    out.appendChild(iconElement(r.result.id));
    if (r.result.count > 1) out.insertAdjacentHTML("beforeend", `<b>${r.result.count}</b>`);
    const name = document.createElement("span");
    name.className = "r-name";
    name.textContent = itemDef(r.result.id)?.name ?? "";
    const ins = document.createElement("span");
    ins.className = "r-in";
    for (const i of r.ingredients) {
      const s = document.createElement("span");
      s.className = this.inv.count(i.id) >= i.count ? "" : "miss";
      s.appendChild(iconElement(i.id));
      s.insertAdjacentHTML("beforeend", `<b>${i.count}</b>`);
      ins.appendChild(s);
    }
    row.append(out, name, ins);
    row.addEventListener("click", e => {
      let made = 0;
      // Shift-click crafts as many as possible
      do {
        if (!craft(this.inv, r)) break;
        made++;
      } while (e.shiftKey && made < 64);
      if (made) this.onSound("craft");
    });
    return row;
  }

  private render(): void {
    this.slotEls.forEach((el, i) => fillSlot(el, this.inv.get(i)));
    fillSlot(this.handEl, this.hand);
    fillSlot(this.float, this.hand);
    this.float.hidden = !this.hand;
    if (this.mode === "survival") this.renderRecipes();
  }

  dispose(): void {
    this.unsub();
    removeEventListener("keydown", this.onKey);
    this.root.remove();
  }
}
