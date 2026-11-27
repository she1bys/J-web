import { itemDef } from "../items/items";
import { iconElement } from "../items/itemIcons";
import type { ItemStack } from "../items/Inventory";
import { MAX_AIR } from "../survival/Vitals";
import { heartIcon, foodIcon, bubbleIcon } from "./icons";

/** Everything drawn flat on top of the 3D view, in the black-and-white pixel style. */
export class Hud {
  readonly root: HTMLElement;
  private slots: HTMLButtonElement[] = [];
  private label: HTMLElement;
  private hint: HTMLElement;
  private toastEl: HTMLElement;
  private fps: HTMLElement;
  private flying: HTMLElement;
  private vitals: HTMLElement;
  private hearts: HTMLElement;
  private food: HTMLElement;
  private air: HTMLElement;
  private hurt: HTMLElement;
  private labelTimer = 0;
  private toastTimer = 0;
  private frames = 0;
  private fpsTime = 0;
  private lastVitals = "";
  private slotKeys: string[] = [];

  constructor(
    parent: HTMLElement,
    touch: boolean,
    onPause: () => void,
    onSelect: (n: number) => void,
  ) {
    this.root = document.createElement("div");
    this.root.className = "hud";
    this.root.innerHTML = `
      <div class="h-hurt"></div>
      <div class="h-sleep"></div>
      <div class="h-cross"></div>
      <div class="h-fps" hidden></div>
      <div class="h-flying" hidden>Flying</div>
      <div class="h-toast"></div>
      <div class="h-label"></div>
      <div class="h-hint"></div>
      <div class="h-vitals" hidden>
        <div class="h-air"></div>
        <div class="h-row"><div class="h-hearts"></div><div class="h-food"></div></div>
      </div>
      <div class="h-hotbar"></div>
      <button class="h-pause" type="button" aria-label="Pause">II</button>`;
    parent.appendChild(this.root);
    const $ = <T extends HTMLElement>(s: string) => this.root.querySelector<T>(s)!;
    this.label = $(".h-label");
    this.hint = $(".h-hint");
    this.toastEl = $(".h-toast");
    this.fps = $(".h-fps");
    this.flying = $(".h-flying");
    this.vitals = $(".h-vitals");
    this.hearts = $(".h-hearts");
    this.food = $(".h-food");
    this.air = $(".h-air");
    this.hurt = $(".h-hurt");
    $(".h-pause").addEventListener("click", e => {
      e.stopPropagation();
      onPause();
    });

    this.hint.innerHTML = touch
      ? "Left thumb: move · Right: look<br>Hold MINE · Tap USE · BAG: items"
      : "Click to play<br>WASD move · Space jump · Shift sprint<br>Hold left click mine · Right click use<br>E items · T or / commands · Esc pause";
    this.hint.classList.toggle("touch", touch);

    const bar = $(".h-hotbar");
    for (let n = 0; n < 9; n++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "h-slot";
      if (!touch) b.dataset.key = String(n + 1);
      b.addEventListener("pointerdown", e => {
        e.stopPropagation();
        onSelect(n);
      });
      bar.appendChild(b);
      this.slots.push(b);
    }
    for (let i = 0; i < 10; i++) {
      for (const row of [this.hearts, this.food, this.air]) row.appendChild(document.createElement("i"));
    }
  }

  /** Redraw hotbar slots from the first 9 inventory slots. */
  setHotbar(stacks: (ItemStack | null)[], infinite: boolean): void {
    stacks.slice(0, 9).forEach((s, n) => {
      const key = s ? `${s.id}:${s.count}:${s.dur ?? ""}:${infinite}` : "";
      if (this.slotKeys[n] === key) return;
      this.slotKeys[n] = key;
      fillSlot(this.slots[n], s, infinite);
    });
  }

  select(n: number, stack: ItemStack | null): void {
    this.slots.forEach((s, i) => s.classList.toggle("sel", i === n));
    const name = stack ? itemDef(stack.id)?.name ?? "" : "";
    this.label.textContent = name;
    this.label.classList.toggle("show", !!name);
    clearTimeout(this.labelTimer);
    this.labelTimer = window.setTimeout(() => this.label.classList.remove("show"), 1400);
  }

  setVitalsVisible(on: boolean): void {
    this.vitals.hidden = !on;
    this.lastVitals = "";
  }

  setVitals(health: number, hunger: number, air: number): void {
    // Include whether air is full, so the bubble row hides again after a short dip.
    const key = `${health}|${hunger}|${Math.ceil(air)}|${air >= MAX_AIR - 0.01}`;
    if (key === this.lastVitals) return;
    this.lastVitals = key;
    const icon = (v: number, i: number, f: (m: "full" | "half" | "empty") => string) =>
      f(v >= (i + 1) * 2 ? "full" : v === i * 2 + 1 ? "half" : "empty");
    [...this.hearts.children].forEach((el, i) => ((el as HTMLElement).style.backgroundImage = `url(${icon(health, i, heartIcon)})`));
    [...this.food.children].forEach((el, i) => ((el as HTMLElement).style.backgroundImage = `url(${icon(hunger, 9 - i, foodIcon)})`));
    const bubbles = Math.ceil(air);
    this.air.classList.toggle("show", air < MAX_AIR - 0.01);
    [...this.air.children].forEach((el, i) => {
      (el as HTMLElement).style.backgroundImage = i >= 10 - bubbles ? `url(${bubbleIcon()})` : "none";
    });
    this.hearts.classList.toggle("low", health <= 6);
  }

  /** Fade to black and back (sleeping through the night). */
  sleepFade(): void {
    const el = this.root.querySelector<HTMLElement>(".h-sleep")!;
    el.classList.remove("on");
    void el.offsetWidth;
    el.classList.add("on");
  }

  flashHurt(): void {
    this.hurt.classList.remove("on");
    void this.hurt.offsetWidth;
    this.hurt.classList.add("on");
  }

  showHint(on: boolean): void {
    this.hint.classList.toggle("hide", !on);
  }

  setFlying(on: boolean): void {
    this.flying.hidden = !on;
  }

  toast(text: string, ms = 2200): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove("show"), ms);
  }

  setFpsVisible(on: boolean): void {
    this.fps.hidden = !on;
  }

  tickFps(dt: number): void {
    this.frames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      this.fps.textContent = `${Math.round(this.frames / this.fpsTime)} FPS`;
      this.frames = 0;
      this.fpsTime = 0;
    }
  }

  dispose(): void {
    clearTimeout(this.labelTimer);
    clearTimeout(this.toastTimer);
    this.root.remove();
  }
}

/** Draw a stack into a slot element: icon, count, and a wear bar for tools. */
export function fillSlot(el: HTMLElement, s: ItemStack | null, infinite = false): void {
  el.replaceChildren();
  if (!s) return;
  el.appendChild(iconElement(s.id));
  if (s.count > 1 && !infinite) {
    const c = document.createElement("span");
    c.className = "count";
    c.textContent = String(s.count);
    el.appendChild(c);
  }
  const tool = itemDef(s.id)?.tool;
  if (tool && s.dur !== undefined && s.dur < tool.durability) {
    const bar = document.createElement("span");
    bar.className = "wear";
    const f = s.dur / tool.durability;
    bar.style.setProperty("--wear", `${Math.round(f * 100)}%`);
    bar.style.setProperty("--wear-color", f > 0.5 ? "#3fbf4a" : f > 0.2 ? "#e8b923" : "#e83a3a");
    el.appendChild(bar);
  }
}
