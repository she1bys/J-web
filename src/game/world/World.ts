import { Block, isSolidBlock } from "./blocks";

/**
 * The block grid, laid out y-major so a horizontal layer is contiguous. Per block:
 * - `data`:  block id
 * - `meta`:  extra state (which way it faces, crop growth stage, …)
 * - `light`: sky light in the high 4 bits, block light (torches) in the low 4 bits
 * Changes made after generation are recorded in `edits` so they can be saved.
 */
export class World {
  readonly data: Uint8Array;
  readonly meta: Uint8Array;
  readonly light: Uint8Array;
  /** index -> block id + meta × 256, for every block changed by the player. */
  readonly edits = new Map<number, number>();
  /** Turn on after generation so only player changes are recorded. */
  recording = false;

  constructor(
    readonly sx: number,
    readonly sy: number,
    readonly sz: number,
  ) {
    this.data = new Uint8Array(sx * sy * sz);
    this.meta = new Uint8Array(sx * sy * sz);
    this.light = new Uint8Array(sx * sy * sz);
  }

  index(x: number, y: number, z: number): number {
    return (y * this.sz + z) * this.sx + x;
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.sx && y < this.sy && z < this.sz;
  }

  get(x: number, y: number, z: number): number {
    return this.inBounds(x, y, z) ? this.data[this.index(x, y, z)] : Block.Air;
  }

  set(x: number, y: number, z: number, id: number, meta = 0): void {
    if (!this.inBounds(x, y, z)) return;
    const i = this.index(x, y, z);
    this.data[i] = id;
    this.meta[i] = meta;
    if (this.recording) this.edits.set(i, id + meta * 256);
  }

  getMeta(x: number, y: number, z: number): number {
    return this.inBounds(x, y, z) ? this.meta[this.index(x, y, z)] : 0;
  }

  setMeta(x: number, y: number, z: number, meta: number): void {
    if (!this.inBounds(x, y, z)) return;
    const i = this.index(x, y, z);
    this.meta[i] = meta;
    if (this.recording) this.edits.set(i, this.data[i] + meta * 256);
  }

  /** Sky light (0–15) at a cell; full daylight above the world. */
  skyLight(x: number, y: number, z: number): number {
    if (y >= this.sy) return 15;
    return this.inBounds(x, y, z) ? this.light[this.index(x, y, z)] >> 4 : 0;
  }

  /** Block light (0–15) from torches and lanterns at a cell. */
  blockLight(x: number, y: number, z: number): number {
    return this.inBounds(x, y, z) ? this.light[this.index(x, y, z)] & 15 : 0;
  }

  /** Fill a box (inclusive bounds). */
  fill(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, id: number): void {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.set(x, y, z, id);
  }

  /** For collisions: outside the world sideways or below counts as a wall. */
  isSolid(x: number, y: number, z: number): boolean {
    if (x < 0 || z < 0 || x >= this.sx || z >= this.sz || y < 0) return true;
    if (y >= this.sy) return false;
    return isSolidBlock(this.data[this.index(x, y, z)]);
  }

  isWater(x: number, y: number, z: number): boolean {
    return this.get(x, y, z) === Block.Water;
  }

  /** Highest solid block in a column, or -1 if none. */
  surfaceY(x: number, z: number): number {
    for (let y = this.sy - 1; y >= 0; y--) if (isSolidBlock(this.get(x, y, z))) return y;
    return -1;
  }

  /** Highest non-air block (solid or water) in a column. */
  topY(x: number, z: number): number {
    for (let y = this.sy - 1; y >= 0; y--) if (this.get(x, y, z) !== Block.Air) return y;
    return -1;
  }

  /** Re-apply saved player changes on top of a freshly generated world. */
  applyEdits(flat: readonly number[]): void {
    for (let k = 0; k + 1 < flat.length; k += 2) {
      const i = flat[k];
      if (i < 0 || i >= this.data.length) continue;
      const v = flat[k + 1];
      this.data[i] = v & 255;
      this.meta[i] = v >> 8;
      this.edits.set(i, v);
    }
  }

  /** Coordinates of a flat index. */
  coords(i: number): [number, number, number] {
    const x = i % this.sx;
    const z = Math.floor(i / this.sx) % this.sz;
    const y = Math.floor(i / (this.sx * this.sz));
    return [x, y, z];
  }
}
