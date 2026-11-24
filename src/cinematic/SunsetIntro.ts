/**
 * An original pixel-art sunset sequence: letterbox bars, a dithered sky,
 * a striped sun rising over the sea, palms and birds, with an optional title card in pink and gold.
 * Rendered at low resolution on a canvas and scaled up with hard pixel edges.
 */
type RGB = readonly [number, number, number];

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const hex = (h: string): RGB => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as unknown as RGB;
const SKY = ["#140826", "#2e0f52", "#5e1a72", "#a3247a", "#e2416f", "#f7804c", "#ffc15e"].map(hex);
const SUN_TOP = hex("#ffe27a");
const SUN_BOT = hex("#ff3d7f");
const SEA_A = hex("#3b1254");
const SEA_B = hex("#14061f");
const GLOW = hex("#ffb36b");
const INK = hex("#0c0414");
const BIRD = hex("#2a0d3d");
const TITLE_A = hex("#ff4fa3");
const TITLE_B = hex("#ffbd4a");
const SHADOW = hex("#1a0628");
const WHITE: RGB = [255, 255, 255];

const LENGTH = 6.4; // seconds before the bars close
const TITLE_AT = 2.9;

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const mix = (a: RGB, b: RGB, f: number): RGB => [
  a[0] + (b[0] - a[0]) * f,
  a[1] + (b[1] - a[1]) * f,
  a[2] + (b[2] - a[2]) * f,
];

export class SunsetIntro {
  private root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rows: string[] = [];
  private t0 = 0;
  private closing = false;
  private finish: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "cine";
    this.root.setAttribute("aria-hidden", "true");
    this.root.innerHTML = '<div class="bar top"></div><canvas></canvas><div class="bar bot"></div>';
    parent.appendChild(this.root);
    this.canvas = this.root.querySelector("canvas")!;
    this.ctx = this.canvas.getContext("2d")!;
  }

  get playing(): boolean {
    return this.finish !== null;
  }

  /** Play the movie, optionally with a title card (a pixel bitmap). Resolves once the bars have closed. */
  play(titleRows: string[] = []): Promise<void> {
    this.rows = titleRows;
    const ps = Math.max(4, Math.round(Math.min(innerWidth, innerHeight) / 110));
    this.canvas.width = Math.ceil(innerWidth / ps);
    this.canvas.height = Math.ceil(innerHeight / ps);
    this.closing = false;
    this.t0 = performance.now();
    this.root.className = "cine on";
    requestAnimationFrame(() => this.root.classList.add("bars"));
    return new Promise(resolve => {
      this.finish = resolve;
      requestAnimationFrame(this.frame);
    });
  }

  /** Close the bars early (tap to skip). */
  skip(): void {
    if (!this.finish || this.closing) return;
    this.closing = true;
    this.root.classList.add("closing");
    setTimeout(() => {
      this.root.className = "cine";
      const done = this.finish;
      this.finish = null;
      done?.();
    }, 520);
  }

  private frame = (now: number): void => {
    if (!this.finish) return;
    const t = (now - this.t0) / 1000;
    if (t > LENGTH) this.skip();
    this.draw(t);
    requestAnimationFrame(this.frame);
  };

  private draw(t: number): void {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const img = this.ctx.createImageData(W, H);
    const d = img.data;
    const hz = Math.round(H * 0.64);
    const rise = ease(t / 3.2);
    const R = Math.min(W, H) * 0.24;
    const cx = W / 2;
    const cy = hz + R * 0.2 - rise * R * 0.95;
    const fade = Math.min(1, t / 0.7);
    const flash = this.rows.length && t > TITLE_AT && t < TITLE_AT + 0.12 ? 0.7 : 0;

    // Foreground: shoreline and two palms
    const fg = new Uint8Array(W * H);
    const shore = (x: number) => H * 0.9 + Math.sin(x * 0.09) * H * 0.015;
    for (let x = 0; x < W; x++) for (let y = Math.floor(shore(x)); y < H; y++) fg[y * W + x] = 1;
    const ph = Math.min(W, H);
    drawPalm(fg, W, H, W * 0.08, shore(W * 0.08), ph * 0.5, 1, t);
    drawPalm(fg, W, H, W * 0.9, shore(W * 0.9), ph * 0.4, -1, t + 1);

    // Title bitmap, revealed left to right
    const cols = this.rows[0]?.length ?? 1;
    const s = Math.max(1, Math.floor(Math.min((W * 0.82) / cols, (H * 0.18) / 7)));
    const tx = Math.round((W - cols * s) / 2);
    const ty = Math.round(H * 0.14);
    const shown = t < TITLE_AT ? -1 : Math.floor(ease((t - TITLE_AT) / 0.5) * cols);
    const titleAt = (x: number, y: number) => {
      const c = Math.floor((x - tx) / s);
      const r = Math.floor((y - ty) / s);
      return this.rows.length > 0 && c >= 0 && c <= shown && c < cols && r >= 0 && r < 7 && this.rows[r][c] === "#";
    };

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const th = BAYER[(y & 3) * 4 + (x & 3)];
        let c: RGB;
        if (y < hz) {
          const f = Math.min(0.999, (y / hz) * (0.55 + 0.45 * rise));
          const p = f * (SKY.length - 1);
          const i = Math.floor(p);
          c = p - i > th ? SKY[i + 1] : SKY[i];
          const dx = x - cx;
          const dy = y - cy;
          if (dx * dx + dy * dy <= R * R) {
            const v = (dy + R) / (2 * R);
            const cut = v > 0.45 && (((y - Math.floor(t * 5)) % 6) + 6) % 6 < (v - 0.45) * 7;
            if (!cut) c = v > th ? SUN_BOT : SUN_TOP;
          }
          if (y === hz - 1) c = GLOW;
        } else {
          const dd = (y - hz) / (H - hz);
          c = dd > th ? SEA_B : SEA_A;
          const w = R * (1 - dd * 0.55) * (0.65 + 0.35 * Math.sin(y * 0.8 + t * 2.4));
          if (Math.abs(x - cx) < w * rise && (y + Math.floor(t * 6)) % 3 === 0 && Math.sin(x * 0.45 + t * 3 + y) > -0.3) {
            c = dd < 0.3 ? SUN_TOP : SUN_BOT;
          }
        }
        for (let b = 0; b < 3; b++) {
          const bx = Math.floor(((t * (7 + b * 2) + b * 37) % (W + 20)) - 10);
          const by = Math.floor(H * (0.12 + b * 0.07) + Math.sin(t * 1.3 + b) * 2);
          const up = Math.floor(t * 4 + b) % 2;
          if ((y === by && Math.abs(x - bx) === 1) || (x === bx && y === by + (up ? 1 : 0)) || (y === by - up && Math.abs(x - bx) === 2)) c = BIRD;
        }
        if (fg[y * W + x]) c = INK;
        if (titleAt(x - 1, y - 1) && !titleAt(x, y)) c = SHADOW;
        if (titleAt(x, y)) c = (y - ty) / (7 * s) > th ? TITLE_B : TITLE_A;
        if (flash) c = mix(c, WHITE, flash);
        const o = (y * W + x) * 4;
        d[o] = c[0] * fade;
        d[o + 1] = c[1] * fade;
        d[o + 2] = c[2] * fade;
        d[o + 3] = 255;
      }
    }
    this.ctx.putImageData(img, 0, 0);
  }
}

/** Pixel palm silhouette: a leaning trunk and drooping, gently swaying fronds. */
function drawPalm(fg: Uint8Array, W: number, H: number, bx: number, by: number, h: number, lean: number, t: number): void {
  const put = (x: number, y: number) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < W && y < H) fg[y * W + x] = 1;
  };
  let topX = bx;
  let topY = by - h;
  for (let k = 0; k <= h; k++) {
    const f = k / h;
    const x = bx + lean * f * f * h * 0.28;
    put(x, by - k);
    put(x + 1, by - k);
    if (k === Math.round(h)) {
      topX = x;
      topY = by - k;
    }
  }
  const sway = Math.sin(t * 1.4) * 0.06;
  const L = h * 0.42;
  for (const a of [-2.9, -2.4, -1.9, -1.25, -0.7, -0.25]) {
    const ang = a + sway;
    for (let s = 0; s < L; s++) {
      const f = s / L;
      const x = topX + Math.cos(ang) * s;
      const y = topY + Math.sin(ang) * s * 0.55 + f * f * L * 0.55;
      put(x, y);
      if (f < 0.7) put(x, y + 1);
    }
  }
}
