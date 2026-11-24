import { createRng } from "../../core/random";
import { Tile, type TileId } from "../world/blocks";

/** All block textures are 16×16 pixel art painted in code into one atlas image. */
export const TILE_SIZE = 16;
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 4;

const HEART = [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."];

/** UV rectangle of a tile: [u0, v0, u1, v1] (v measured from the bottom). */
export function tileUV(t: TileId): [number, number, number, number] {
  const col = t % ATLAS_COLS;
  const row = Math.floor(t / ATLAS_COLS);
  const u0 = col / ATLAS_COLS;
  const v1 = 1 - row / ATLAS_ROWS;
  return [u0, v1 - 1 / ATLAS_ROWS, u0 + 1 / ATLAS_COLS, v1];
}

export function paintAtlas(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = ATLAS_COLS * TILE_SIZE;
  c.height = ATLAS_ROWS * TILE_SIZE;
  const g = c.getContext("2d")!;
  const r = createRng(11);
  const pick = (a: readonly string[]) => a[Math.floor(r() * a.length)];
  /** Paint tile `t` pixel by pixel; returning null leaves the pixel transparent. */
  const paint = (t: TileId, f: (x: number, y: number) => string | null) => {
    const ox = (t % ATLAS_COLS) * TILE_SIZE;
    const oy = Math.floor(t / ATLAS_COLS) * TILE_SIZE;
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const col = f(x, y);
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  };

  const GR = ["#5fae3e", "#6cbf4a", "#6cbf4a", "#7bcc56", "#529a35"];
  const DI = ["#7b4f32", "#8a5a3b", "#8a5a3b", "#9a6946", "#694229"];
  const ST = ["#8a8a8a", "#8a8a8a", "#979797", "#7b7b7b", "#6d6d6d"];
  const LE = ["#3c8a35", "#3c8a35", "#4c9e42", "#2f6e2a", "#23551f"];
  const PI = ["#2f6b4a", "#2f6b4a", "#3a7d57", "#24563b", "#1c4430"];
  const SA = ["#e6d29a", "#e6d29a", "#eedba6", "#d8c287"];
  const SS = ["#d9bf7f", "#d9bf7f", "#cdb172", "#e2c98c"];
  const PL = ["#b98a52", "#c2945d", "#ae7f48"];
  const RO = ["#ff6fa5", "#ff7db0", "#f45f98"];
  const SN = ["#f4f8fb", "#ffffff", "#e8eff5", "#f4f8fb"];
  const CA = ["#3f8f3a", "#4a9c43", "#367e32"];
  const WA = ["#3d7fd6", "#3d7fd6", "#4a8ce0", "#3573c4"];
  const CO = ["#7d7d7d", "#8f8f8f", "#6a6a6a", "#9a9a9a"];

  paint(Tile.GrassTop, () => pick(GR));
  const edge = Array.from({ length: 16 }, () => 3 + Math.floor(r() * 3));
  paint(Tile.GrassSide, (x, y) => (y < edge[x] ? pick(GR) : pick(DI)));
  paint(Tile.Dirt, () => pick(DI));
  paint(Tile.Stone, () => pick(ST));
  paint(Tile.WoodSide, x => (x % 5 === 0 ? "#5a3a20" : r() < 0.15 ? "#8a6240" : "#74502f"));
  paint(Tile.WoodTop, (x, y) => {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    return d > 6.5 ? "#5a3a20" : Math.floor(d) % 2 ? "#b88a55" : "#a3763f";
  });
  paint(Tile.Leaves, () => (r() < 0.14 ? null : pick(LE)));
  paint(Tile.Sand, () => pick(SA));
  paint(Tile.Planks, (x, y) => {
    const row = Math.floor(y / 4);
    if (y % 4 === 3) return "#7d5a33";
    if (x === (row * 7 + 3) % 16) return "#8d6638";
    return pick(PL);
  });
  paint(Tile.Rose, (x, y) => {
    const hx = x - 4;
    const hy = y - 5;
    if (hy >= 0 && hy < 6 && hx >= 0 && hx < 7 && HEART[hy][hx] === "#") return "#ffd6e6";
    return pick(RO);
  });
  paint(Tile.Snow, () => pick(SN));
  const snowEdge = Array.from({ length: 16 }, () => 3 + Math.floor(r() * 3));
  paint(Tile.SnowSide, (x, y) => (y < snowEdge[x] ? pick(SN) : pick(DI)));
  paint(Tile.Ice, (x, y) => ((x + y * 2) % 11 === 0 || (x * 3 + y) % 17 === 0 ? "#e9f7ff" : r() < 0.5 ? "#9fd3f0" : "#acdbf4"));
  paint(Tile.Water, (x, y) => ((y + Math.floor(x / 4)) % 5 === 0 && r() < 0.6 ? "#7fb2ee" : pick(WA)));
  paint(Tile.CactusSide, (x, y) => (x % 4 === 1 ? (y % 3 === 0 ? "#e8e2c0" : "#2d6e2a") : pick(CA)));
  paint(Tile.CactusTop, (x, y) => (x === 0 || y === 0 || x === 15 || y === 15 ? "#2d6e2a" : pick(CA)));
  paint(Tile.SandstoneSide, (_x, y) => (y === 4 || y === 11 ? "#bfa265" : pick(SS)));
  paint(Tile.SandstoneTop, (x, y) => (x === 0 || y === 0 || x === 15 || y === 15 ? "#bfa265" : pick(SS)));
  paint(Tile.PineLeaves, () => (r() < 0.12 ? null : pick(PI)));
  paint(Tile.Glass, (x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return "#d8eef7";
    if ((x === 3 && y > 2 && y < 7) || (x === 4 && y > 3 && y < 6)) return "#ffffff";
    return null;
  });
  paint(Tile.Brick, (x, y) => {
    if (y % 4 === 3) return "#d8cfc4";
    const shift = Math.floor(y / 4) % 2 ? 4 : 0;
    if ((x + shift) % 8 === 7) return "#d8cfc4";
    return r() < 0.3 ? "#a8483b" : "#b9554a";
  });
  paint(Tile.Cobble, (x, y) => {
    const cell = Math.floor(x / 5) + Math.floor((y + (Math.floor(x / 5) % 2) * 2) / 5) * 3;
    const ex = x % 5 === 4;
    const ey = (y + (Math.floor(x / 5) % 2) * 2) % 5 === 4;
    return ex || ey ? "#555555" : CO[cell % CO.length];
  });
  paint(Tile.PalmSide, (_x, y) => (y % 4 === 0 ? "#8a6a42" : r() < 0.2 ? "#b8915e" : "#a5804f"));
  paint(Tile.Lantern, (x, y) => {
    if (x < 2 || x > 13 || y < 2 || y > 13) return "#2a2a2a";
    if (x === 7 || x === 8 || y === 7 || y === 8) return "#2a2a2a";
    return (x + y) % 5 === 0 ? "#fff3b0" : "#ffd25e";
  });

  // Crack overlays for mining: more cracks per stage, transparent elsewhere.
  const crackPaths = [
    [[7, 7], [8, 8], [8, 6], [6, 8]],
    [[5, 5], [9, 9], [10, 6], [5, 10], [9, 4], [6, 3]],
    [[3, 3], [12, 12], [12, 4], [3, 12], [11, 2], [2, 7], [13, 9], [7, 13]],
    [[1, 1], [14, 14], [14, 2], [1, 14], [2, 9], [13, 6], [9, 1], [6, 14], [4, 7], [10, 11]],
  ];
  const crackTiles = [Tile.Crack1, Tile.Crack2, Tile.Crack3, Tile.Crack4] as const;
  crackTiles.forEach((t, stage) => {
    const on = new Set<string>();
    // Draw jagged lines from the centre to each end point of this stage and all earlier ones.
    for (let s = 0; s <= stage; s++) {
      for (const [ex, ey] of crackPaths[s]) {
        let x = 7.5;
        let y = 7.5;
        const steps = Math.max(Math.abs(ex - x), Math.abs(ey - y));
        for (let k = 0; k <= steps; k++) {
          on.add(`${Math.round(x)},${Math.round(y)}`);
          x += (ex - 7.5) / steps;
          y += (ey - 7.5) / steps;
        }
      }
    }
    paint(t, (x, y) => (on.has(`${x},${y}`) ? "rgba(0,0,0,0.75)" : null));
  });

  return c;
}

/** Average colour of a tile, used for block debris. */
export function tileAverage(atlas: HTMLCanvasElement, t: TileId): [number, number, number] {
  const x = (t % ATLAS_COLS) * TILE_SIZE;
  const y = Math.floor(t / ATLAS_COLS) * TILE_SIZE;
  const d = atlas.getContext("2d")!.getImageData(x, y, TILE_SIZE, TILE_SIZE).data;
  let rr = 0, gg = 0, bb = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    rr += d[i]; gg += d[i + 1]; bb += d[i + 2]; n++;
  }
  n = Math.max(1, n);
  return [rr / n / 255, gg / n / 255, bb / n / 255];
}
