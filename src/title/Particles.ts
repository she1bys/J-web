/** 2D pixel debris drawn on a full-screen canvas: blocks shattering and dust puffs. */
interface Particle {
  x: number; y: number; vx: number; vy: number;
  size: number; shade: number; life: number; grav: number;
}

export class Particles {
  private ctx: CanvasRenderingContext2D;
  private list: Particle[] = [];
  private running = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
  }

  resize(dpr: number): void {
    this.canvas.width = innerWidth * dpr;
    this.canvas.height = innerHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private spawn(p: Particle): void {
    this.list.push(p);
    if (!this.running) {
      this.running = true;
      requestAnimationFrame(this.step);
    }
  }

  /** A block bursts into small square chunks that hop out and fall. */
  shatter(el: Element): void {
    const r = el.getBoundingClientRect();
    const s = Math.max(3, Math.round(r.width / 3));
    for (let gy = 0; gy < 3; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        if (Math.random() < 0.35) continue;
        this.spawn({
          x: r.left + gx * s,
          y: r.top + gy * s,
          vx: (gx - 1) * 1.4 + (Math.random() - 0.5) * 2.2,
          vy: -2.5 - Math.random() * 3.5,
          size: s - (Math.random() < 0.5 ? 1 : 0),
          shade: [0, 30, 70][Math.floor(Math.random() * 3)],
          life: 60 + Math.random() * 50,
          grav: 0.45,
        });
      }
    }
  }

  /** Light grey puff when a block is placed back. */
  puff(el: Element): void {
    const r = el.getBoundingClientRect();
    const s = Math.max(2, Math.round(r.width / 5));
    for (let n = 0; n < 2; n++) {
      this.spawn({
        x: r.left + Math.random() * r.width,
        y: r.top + r.height - s,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -0.6 - Math.random() * 0.8,
        size: s, shade: 190, life: 22, grav: 0.02,
      });
    }
  }

  private step = (): void => {
    const { ctx } = this;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const floor = innerHeight - 2;
    this.list = this.list.filter(p => (p.life -= 1) > 0);
    for (const p of this.list) {
      p.vy += p.grav;
      p.x += p.vx;
      p.y += p.vy;
      if (p.y + p.size > floor) {
        p.y = floor - p.size;
        p.vy *= -0.35;
        p.vx *= 0.7;
      }
      const a = Math.min(1, p.life / 20);
      ctx.fillStyle = `rgba(${p.shade},${p.shade},${p.shade},${a})`;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    if (this.list.length) requestAnimationFrame(this.step);
    else {
      this.running = false;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
    }
  };
}
