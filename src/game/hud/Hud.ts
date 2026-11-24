import { BLOCKS, type BlockId } from "../world/blocks";
import { TILE_SIZE, ATLAS_COLS } from "../textures/atlas";

/** Everything drawn flat on top of the 3D view, in the black-and-white pixel style. */
export class Hud {
  readonly root: HTMLElement;
  private slots: HTMLButtonElement[] = [];
  private label: HTMLElement;
  private hint: HTMLElement;
  private toastEl: HTMLElement;
  private letters: HTMLElement;
  private fps: HTMLElement;
  private flying: HTMLElement;
  private labelTimer = 0;
  private toastTimer = 0;
  private frames = 0;
  private fpsTime = 0;

  constructor(
    parent: HTMLElement,
    atlas: HTMLCanvasElement,
    hotbar: readonly BlockId[],
    word: string,
    touch: boolean,
    onPause: () => void,
    onSelect: (n: number) => void,
  ) {
    this.root = document.createElement("div");
    this.root.className = "hud";
    this.root.innerHTML = `
      <div class="h-cross"></div>
      <div class="h-letters" aria-label="Letters found"></div>
      <div class="h-fps" hidden></div>
      <div class="h-flying" hidden>FLYING</div>
      <div class="h-toast"></div>
      <div class="h-label"></div>
      <div class="h-hint"></div>
      <div class="h-hotbar"></div>
      <button class="h-pause" type="button" aria-label="Pause">II</button>`;
    parent.appendChild(this.root);
    const $ = <T extends HTMLElement>(s: string) => this.root.querySelector<T>(s)!;
    this.label = $(".h-label");
    this.hint = $(".h-hint");
    this.toastEl = $(".h-toast");
    this.letters = $(".h-letters");
    this.fps = $(".h-fps");
    this.flying = $(".h-flying");
    $(".h-pause").addEventListener("click", e => {
      e.stopPropagation();
      onPause();
    });

    this.hint.innerHTML = touch
      ? "Left thumb: move · Right: look<br>Hold MINE · Tap BUILD"
      : "Click to play<br>WASD move · Space jump · Shift sprint<br>Hold left click mine · Right click build<br>1-9 blocks · V camera · Esc pause";
    this.hint.classList.toggle("touch", touch);

    const bar = $(".h-hotbar");
    hotbar.forEach((id, n) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "h-slot";
      b.setAttribute("aria-label", BLOCKS[id]?.name ?? "");
      const icon = document.createElement("canvas");
      icon.width = icon.height = TILE_SIZE;
      const t = BLOCKS[id]?.tiles[1] ?? 0;
      icon.getContext("2d")!.drawImage(
        atlas, (t % ATLAS_COLS) * TILE_SIZE, Math.floor(t / ATLAS_COLS) * TILE_SIZE, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE,
      );
      b.appendChild(icon);
      if (!touch) {
        const k = document.createElement("span");
        k.className = "h-key";
        k.textContent = String(n + 1);
        b.appendChild(k);
      }
      b.addEventListener("pointerdown", e => {
        e.stopPropagation();
        onSelect(n);
      });
      bar.appendChild(b);
      this.slots.push(b);
    });

    [...word].forEach(ch => {
      const s = document.createElement("span");
      s.textContent = ch;
      this.letters.appendChild(s);
    });
  }

  select(n: number, name: string): void {
    this.slots.forEach((s, i) => s.classList.toggle("sel", i === n));
    this.label.textContent = name;
    this.label.classList.add("show");
    clearTimeout(this.labelTimer);
    this.labelTimer = window.setTimeout(() => this.label.classList.remove("show"), 1200);
  }

  setLetters(found: ReadonlySet<number>): void {
    [...this.letters.children].forEach((el, i) => el.classList.toggle("got", found.has(i)));
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
