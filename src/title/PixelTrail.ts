/** Background grid whose cells light up grey under the cursor and fade out. */
export class PixelTrail {
  private ctx: CanvasRenderingContext2D;
  private cell = 16;
  private cols = 0;
  private rows = 0;
  private heat = new Float32Array(0);
  private active = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
  }

  resize(dpr: number, cell: number): void {
    this.canvas.width = innerWidth * dpr;
    this.canvas.height = innerHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cell = Math.max(4, cell);
    this.cols = Math.ceil(innerWidth / this.cell);
    this.rows = Math.ceil(innerHeight / this.cell);
    this.heat = new Float32Array(this.cols * this.rows);
  }

  warm(x: number, y: number): void {
    const c = Math.floor(x / this.cell);
    const r = Math.floor(y / this.cell);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cc = c + dx;
        const rr = r + dy;
        if (cc < 0 || rr < 0 || cc >= this.cols || rr >= this.rows) continue;
        const v = dx || dy ? 0.45 : 1;
        const i = rr * this.cols + cc;
        this.heat[i] = Math.max(this.heat[i], v);
      }
    }
    if (!this.active) {
      this.active = true;
      requestAnimationFrame(this.draw);
    }
  }

  private draw = (): void => {
    const { ctx, heat, cols, cell } = this;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    let any = false;
    for (let n = 0; n < heat.length; n++) {
      const h = heat[n];
      if (h <= 0) continue;
      any = true;
      ctx.fillStyle = `rgba(0,0,0,${h * 0.12})`;
      ctx.fillRect((n % cols) * cell, Math.floor(n / cols) * cell, cell - 1, cell - 1);
      heat[n] = Math.max(0, h - 0.025);
    }
    this.active = any;
    if (any) requestAnimationFrame(this.draw);
  };
}
