import type { Rng } from "../../../core/random";
import { Block, type BlockId } from "../../world/blocks";
import type { World } from "../../world/World";

/** Set a block only where there is air, so features never carve into terrain. */
const place = (w: World, x: number, y: number, z: number, id: BlockId) => {
  if (w.get(x, y, z) === Block.Air) w.set(x, y, z, id);
};

/** A round-topped broadleaf tree. */
export function oakTree(w: World, rng: Rng, x: number, y: number, z: number): void {
  const h = 4 + Math.floor(rng() * 2);
  for (let k = 1; k <= h; k++) w.set(x, y + k, z, Block.Wood);
  for (let dy = -2; dy <= 1; dy++) {
    const rad = dy === 1 ? 1 : 2;
    for (let dz = -rad; dz <= rad; dz++) {
      for (let dx = -rad; dx <= rad; dx++) {
        if (Math.abs(dx) === rad && Math.abs(dz) === rad && rng() < 0.6) continue;
        place(w, x + dx, y + h + dy, z + dz, Block.Leaves);
      }
    }
  }
}

/** A tall cone-shaped evergreen, optionally dusted with snow on top. */
export function pineTree(w: World, rng: Rng, x: number, y: number, z: number, snowy = false): void {
  const h = 6 + Math.floor(rng() * 3);
  for (let k = 1; k <= h; k++) w.set(x, y + k, z, Block.Wood);
  let rad = 2;
  for (let k = 3; k <= h + 1; k++) {
    const r = k === h + 1 ? 0 : rad;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) + Math.abs(dz) > r + 1) continue;
        place(w, x + dx, y + k, z + dz, Block.PineLeaves);
      }
    }
    if (k % 2 === 0) rad = Math.max(1, rad - 1);
  }
  if (snowy) place(w, x, y + h + 2, z, Block.Snow);
}

/** A curved palm with drooping fronds. */
export function palmTree(w: World, rng: Rng, x: number, y: number, z: number): void {
  const h = 5 + Math.floor(rng() * 3);
  const lean = rng() < 0.5 ? 1 : -1;
  const alongX = rng() < 0.5;
  let tx = x;
  let tz = z;
  for (let k = 1; k <= h; k++) {
    if (k === Math.floor(h * 0.6)) {
      if (alongX) tx += lean;
      else tz += lean;
    }
    w.set(tx, y + k, tz, Block.PalmWood);
  }
  const top = y + h + 1;
  place(w, tx, top, tz, Block.Leaves);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    place(w, tx + dx, top, tz + dz, Block.Leaves);
    if (dx === 0 || dz === 0) {
      place(w, tx + dx * 2, top - 1, tz + dz * 2, Block.Leaves);
      place(w, tx + dx * 3, top - 2, tz + dz * 3, Block.Leaves);
    }
  }
}

export function cactus(w: World, rng: Rng, x: number, y: number, z: number): void {
  const h = 2 + Math.floor(rng() * 3);
  for (let k = 1; k <= h; k++) w.set(x, y + k, z, Block.Cactus);
}

/** A stepped pyramid with a rose-block capstone. */
export function pyramid(w: World, cx: number, baseY: number, cz: number, half: number): void {
  for (let level = 0; level <= half; level++) {
    const r = half - level;
    w.fill(cx - r, baseY + level, cz - r, cx + r, baseY + level, cz + r, Block.Sandstone);
  }
  w.set(cx, baseY + half + 1, cz, Block.Rose);
  // A doorway on the south side.
  w.fill(cx, baseY, cz + half - 1, cx, baseY + 1, cz + half, Block.Air);
}

/** A small cabin with planks, a glass window and a lantern. */
export function cabin(w: World, x: number, y: number, z: number): void {
  w.fill(x, y, z, x + 5, y, z + 4, Block.Cobble);
  w.fill(x, y + 1, z, x + 5, y + 3, z + 4, Block.Planks);
  w.fill(x + 1, y + 1, z + 1, x + 4, y + 3, z + 3, Block.Air);
  w.fill(x - 1, y + 4, z - 1, x + 6, y + 4, z + 5, Block.Brick);
  w.fill(x, y + 5, z, x + 5, y + 5, z + 4, Block.Brick);
  w.fill(x + 2, y + 1, z + 4, x + 2, y + 2, z + 4, Block.Air); // door
  w.set(x + 4, y + 2, z + 4, Block.Glass);
  w.set(x, y + 2, z + 2, Block.Glass);
  w.set(x + 4, y + 1, z + 1, Block.Lantern);
}
