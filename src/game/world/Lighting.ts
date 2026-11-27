import { BLOCKS, Block, isOpaque } from "./blocks";
import { CHUNK } from "./chunk";
import type { World } from "./World";

/** Light lost passing through a cell, on top of the usual 1 per step. */
function absorb(id: number): number {
  if (id === Block.Water) return 2;
  if (id === Block.Leaves || id === Block.PineLeaves) return 1;
  return 0;
}

/**
 * Sky light and block light, stored per cell in `world.light` (sky in the high 4 bits,
 * block light in the low 4 bits).
 *
 * Sky light shines straight down at full strength until something solid stops it, then
 * spreads sideways (into caves, under trees) losing one level per step. Block light spreads
 * out from torches and lanterns the same way. After an edit only the area within 16 blocks of
 * the change is recomputed, which is as far as light can travel.
 */
export class Lighting {
  private queue = new Int32Array(0);

  constructor(private world: World) {}

  computeAll(): void {
    this.computeRegion(0, 0, this.world.sx - 1, this.world.sz - 1);
  }

  /**
   * Recompute light around a changed block. Returns the chunks whose light actually changed
   * (as "cx,cz" keys), so only those meshes need rebuilding.
   */
  update(x: number, z: number): Set<string> {
    return this.updateBox(x, z, x, z);
  }

  /** Recompute light for everything that changed inside a box (plus the 16 blocks around it). */
  updateBox(ax: number, az: number, bx: number, bz: number): Set<string> {
    const w = this.world;
    const x0 = Math.max(0, Math.min(ax, bx) - 16);
    const z0 = Math.max(0, Math.min(az, bz) - 16);
    const x1 = Math.min(w.sx - 1, Math.max(ax, bx) + 16);
    const z1 = Math.min(w.sz - 1, Math.max(az, bz) + 16);
    const before = this.snapshot(x0, z0, x1, z1);
    this.computeRegion(x0, z0, x1, z1);
    const changed = new Set<string>();
    let k = 0;
    for (let y = 0; y < w.sy; y++) {
      for (let zz = z0; zz <= z1; zz++) {
        const row = w.index(x0, y, zz);
        for (let xx = x0; xx <= x1; xx++, k++) {
          if (before[k] !== w.light[row + (xx - x0)]) changed.add(`${Math.floor(xx / CHUNK)},${Math.floor(zz / CHUNK)}`);
        }
      }
    }
    return changed;
  }

  private snapshot(x0: number, z0: number, x1: number, z1: number): Uint8Array {
    const w = this.world;
    const width = x1 - x0 + 1;
    const out = new Uint8Array(width * (z1 - z0 + 1) * w.sy);
    let k = 0;
    for (let y = 0; y < w.sy; y++) {
      for (let z = z0; z <= z1; z++) {
        const row = w.index(x0, y, z);
        out.set(w.light.subarray(row, row + width), k);
        k += width;
      }
    }
    return out;
  }

  private computeRegion(x0: number, z0: number, x1: number, z1: number): void {
    const w = this.world;
    const { sx, sy, sz, data, light } = w;
    // A ring buffer: a cell can be queued again if its light improves, so leave plenty of room.
    const need = ((x1 - x0 + 3) * (z1 - z0 + 3) * sy) * 2;
    if (this.queue.length < need) this.queue = new Int32Array(need);
    const q = this.queue;
    const cap = q.length;
    let head = 0;
    let tail = 0;
    const push = (i: number) => {
      q[tail % cap] = i;
      tail++;
    };

    // 1. Clear, then pour sunlight straight down each column; seed light sources.
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        let sun = 15;
        for (let y = sy - 1; y >= 0; y--) {
          const i = w.index(x, y, z);
          const id = data[i];
          if (sun > 0 && isOpaque(id)) sun = 0;
          else if (sun > 0) sun = Math.max(0, sun - absorb(id));
          const emit = BLOCKS[id]?.light ?? 0;
          light[i] = (sun << 4) | emit;
          if (sun > 1 || emit > 1) push(i);
        }
      }
    }
    // 2. Light already outside the region flows back in across its edges.
    const edge = (x: number, z: number) => {
      if (x < 0 || z < 0 || x >= sx || z >= sz) return;
      for (let y = 0; y < sy; y++) {
        const i = w.index(x, y, z);
        if (light[i] > 0x10 || (light[i] & 15) > 1) push(i);
      }
    };
    for (let x = x0; x <= x1; x++) {
      edge(x, z0 - 1);
      edge(x, z1 + 1);
    }
    for (let z = z0; z <= z1; z++) {
      edge(x0 - 1, z);
      edge(x1 + 1, z);
    }

    // 3. Spread: each step loses one level (more through water and leaves).
    const layer = sx * sz;
    while (head < tail) {
      const i = q[head++ % cap];
      const s = light[i] >> 4;
      const b = light[i] & 15;
      const x = i % sx;
      const z = Math.floor(i / sx) % sz;
      const y = Math.floor(i / layer);
      for (let n = 0; n < 6; n++) {
        let nx = x, ny = y, nz = z;
        if (n === 0) nx--; else if (n === 1) nx++; else if (n === 2) ny--; else if (n === 3) ny++; else if (n === 4) nz--; else nz++;
        if (nx < x0 || nx > x1 || nz < z0 || nz > z1 || ny < 0 || ny >= sy) continue;
        const j = i + (nx - x) + (nz - z) * sx + (ny - y) * layer;
        const id = data[j];
        if (isOpaque(id)) continue;
        const loss = 1 + absorb(id);
        const ns = s - loss;
        const nb = b - loss;
        const cs = light[j] >> 4;
        const cb = light[j] & 15;
        if (ns > cs || nb > cb) {
          light[j] = (Math.max(ns, cs) << 4) | Math.max(nb, cb);
          push(j);
        }
      }
    }
  }
}

/** Brightness (0–1) for a light level (0–15): each level is a bit dimmer than the last. */
export const brightness = (level: number): number => (level <= 0 ? 0 : Math.pow(0.82, 15 - level));
