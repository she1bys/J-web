/**
 * Keeps the frame rate smooth by rendering at a lower resolution when frames are slow,
 * and raising it again when there's headroom. Matters most on phones (older iPhones,
 * Low Power Mode, hot devices that throttle).
 */
export class AdaptiveQuality {
  /** Multiplier for the render resolution, between `min` and 1. */
  scale = 1;
  private time = 0;
  private frames = 0;
  private cooldown = 0;

  constructor(private readonly min = 0.5) {}

  /** Feed one frame's duration. Returns true when the scale changed (resize the renderer). */
  sample(dt: number): boolean {
    this.time += dt;
    this.frames++;
    this.cooldown -= dt;
    if (this.time < 1.5) return false;
    const avg = this.time / this.frames;
    this.time = 0;
    this.frames = 0;
    if (this.cooldown > 0) return false;
    if (avg > 1 / 42 && this.scale > this.min) {
      // Below ~42 fps: step down quickly.
      this.scale = Math.max(this.min, this.scale * 0.85);
      this.cooldown = 2;
      return true;
    }
    if (avg < 1 / 57 && this.scale < 1) {
      // Comfortably above 57 fps: step back up slowly.
      this.scale = Math.min(1, this.scale * 1.08);
      this.cooldown = 5;
      return true;
    }
    return false;
  }
}
