import { glyph, GLYPH_HEIGHT } from "../fonts/pixelFont";
import { runTimeline, prefersReducedMotion, wait, type Step } from "../core/timeline";
import type { Particles } from "./Particles";

/**
 * The big pixel name on the title screen. Each filled pixel is a DOM block, which lets it
 * assemble pixel by pixel, flip letter by letter, break apart and be rebuilt.
 */
export class TitleScreen {
  /** Every filled pixel of the name. */
  private blocks: HTMLElement[] = [];
  private flipping = false;
  private readonly reduce = prefersReducedMotion();

  constructor(
    private nameEl: HTMLElement,
    private stageEl: HTMLElement,
    private particles: Particles,
  ) {}

  /** Pixel size on screen, used to match the cursor trail grid. */
  get pixelSize(): number {
    return this.blocks[0]?.getBoundingClientRect().width ?? 16;
  }

  build(text: string): void {
    this.nameEl.innerHTML = "";
    this.nameEl.setAttribute("aria-label", text);
    this.blocks = [];
    let columns = 0;
    [...text].forEach((ch, i) => {
      const rows = glyph(ch);
      columns += rows[0].length + (i ? 1 : 0);
      const g = document.createElement("span");
      g.className = "glyph";
      g.setAttribute("aria-hidden", "true");
      g.style.gridTemplateColumns = `repeat(${rows[0].length}, auto)`;
      for (let r = 0; r < GLYPH_HEIGHT; r++) {
        for (const c of rows[r]) {
          const px = document.createElement("i");
          if (c === "#") this.blocks.push(px);
          g.appendChild(px);
        }
      }
      this.nameEl.appendChild(g);
    });
    // Size pixels so the whole name fits the screen width.
    document.documentElement.style.setProperty("--cols", String(columns));
  }

  /** Light the pixels up in random order. */
  async assemble(): Promise<void> {
    if (this.reduce) {
      this.blocks.forEach(b => b.classList.add("lit"));
      return;
    }
    const order = [...this.blocks].sort(() => Math.random() - 0.5);
    await runTimeline(order.map((b, n): Step => [(n / order.length) * 1200, () => b.classList.add("lit")]));
  }

  /** Split-flap wave across the letters. */
  flip(): void {
    if (this.flipping || this.reduce) return;
    this.flipping = true;
    const glyphs = [...this.nameEl.children] as HTMLElement[];
    glyphs.forEach((g, n) => {
      g.classList.remove("flip");
      void g.offsetWidth;
      g.style.animationDelay = `${n * 70}ms`;
      g.classList.add("flip");
    });
    setTimeout(() => {
      glyphs.forEach(g => g.classList.remove("flip"));
      this.flipping = false;
    }, glyphs.length * 70 + 600);
  }

  /** Block-mining: crack the block nearest (x, y), then break outward from there. */
  async mine(x: number, y: number): Promise<void> {
    if (this.reduce) {
      this.blocks.forEach(b => b.classList.remove("lit"));
      return;
    }
    const centers = this.blocks.map(b => {
      const r = b.getBoundingClientRect();
      return Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
    });
    const nearest = Math.min(...centers);
    const crack = (b: HTMLElement, c?: string) => {
      b.classList.remove("c1", "c2", "c3");
      if (c) b.classList.add(c);
    };
    const steps: Step[] = [];
    this.blocks.forEach((b, n) => {
      const first = centers[n] === nearest;
      const t = 330 + (centers[n] - nearest) * 1.3;
      const spacing = first ? 110 : 55;
      steps.push([t - spacing * 3, () => crack(b, "c1")]);
      steps.push([t - spacing * 2, () => crack(b, "c2")]);
      steps.push([t - spacing, () => crack(b, "c3")]);
      steps.push([t, () => {
        crack(b);
        b.classList.remove("lit", "place");
        this.particles.shatter(b);
        if (first) this.shake();
      }]);
    });
    await runTimeline(steps);
    await wait(650); // let the debris fall
  }

  /** Place the blocks back, bottom row first. */
  async rebuild(): Promise<void> {
    const byHeight = this.blocks
      .map(b => [b, b.getBoundingClientRect()] as const)
      .sort((a, b) => b[1].top - a[1].top || a[1].left - b[1].left);
    if (this.reduce) {
      this.blocks.forEach(b => b.classList.add("lit"));
      return;
    }
    await runTimeline(byHeight.map(([b], n): Step => [300 + n * 9, () => {
      b.classList.add("lit", "place");
      this.particles.puff(b);
    }]));
    await wait(200);
    this.blocks.forEach(b => b.classList.remove("place"));
  }

  private shake(): void {
    this.stageEl.classList.remove("shake");
    void this.stageEl.offsetWidth;
    this.stageEl.classList.add("shake");
  }
}
