import { paintAtlas, TILE_SIZE, ATLAS_COLS } from "../textures/atlas";
import { BLOCKS } from "../world/blocks";
import { itemDef, Item } from "./items";

/**
 * 16×16 pixel icons for every item. Blocks use their side texture; tools, food and
 * materials are drawn here pixel by pixel (original art for this project).
 */
type Px = [x: number, y: number];
type Painter = (put: (x: number, y: number, c: string) => void) => void;

const WOOD = ["#a5804f", "#7a5230"];
const STONE = ["#9a9a9a", "#5e5e5e"];
const HANDLE = ["#8a6240", "#5a3a20"];

/** A diagonal handle from bottom-left toward the top-right. */
const handle = (put: (x: number, y: number, c: string) => void, to: number) => {
  for (let i = 2; i <= to; i++) {
    put(i, 15 - i, HANDLE[0]);
    put(i + 1, 15 - i, HANDLE[1]);
  }
};

const PICK_HEAD: Px[] = [
  [5, 2], [6, 2], [7, 2], [8, 2], [9, 3], [10, 3], [11, 4], [12, 5], [13, 6], [13, 7], [14, 8], [14, 9], [14, 10],
  [6, 3], [7, 3], [8, 3], [10, 4], [11, 5], [12, 6], [12, 7], [13, 8], [13, 9],
];
const AXE_HEAD: Px[] = [];
for (let y = 1; y <= 7; y++) for (let x = 8; x <= 13; x++) if (!((x === 13 && (y === 1 || y === 7)) || (x === 8 && y === 7))) AXE_HEAD.push([x, y]);
const SHOVEL_HEAD: Px[] = [];
for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.hypot(x - 11.5, y - 4.5) < 2.9) SHOVEL_HEAD.push([x, y]);

const head = (pts: Px[], [light, dark]: string[]): Painter => put => {
  for (const [x, y] of pts) put(x, y, (x + y) % 4 === 0 ? dark : light);
};

const SPRITES: Record<number, Painter> = {
  [Item.Stick]: put => handle(put, 13),
  [Item.Apple]: put => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot((x - 7.5) * 1.05, y - 9.5);
        if (d < 5.4) put(x, y, d < 2.2 && x < 8 && y < 9 ? "#ff8a8a" : y > 12 ? "#a51f2a" : "#d8303a");
      }
    }
    put(7, 3, "#5a3a20"); put(7, 4, "#5a3a20");
    put(8, 3, "#3f8f3a"); put(9, 2, "#3f8f3a"); put(10, 2, "#4c9e42"); put(9, 3, "#4c9e42");
  },
  [Item.WoodenPickaxe]: put => { handle(put, 10); head(PICK_HEAD, WOOD)(put); },
  [Item.StonePickaxe]: put => { handle(put, 10); head(PICK_HEAD, STONE)(put); },
  [Item.WoodenAxe]: put => { handle(put, 11); head(AXE_HEAD, WOOD)(put); },
  [Item.StoneAxe]: put => { handle(put, 11); head(AXE_HEAD, STONE)(put); },
  [Item.WoodenShovel]: put => { handle(put, 9); head(SHOVEL_HEAD, WOOD)(put); },
  [Item.StoneShovel]: put => { handle(put, 9); head(SHOVEL_HEAD, STONE)(put); },
};

let atlas: HTMLCanvasElement | null = null;
const cache = new Map<number, HTMLCanvasElement>();

/** The icon as a 16×16 canvas (shared; draw it into your own canvas, don't insert it). */
export function itemIcon(id: number): HTMLCanvasElement {
  let c = cache.get(id);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = c.height = TILE_SIZE;
  const g = c.getContext("2d")!;
  const def = itemDef(id);
  if (def?.block !== undefined) {
    atlas ??= paintAtlas();
    const t = BLOCKS[def.block]?.tiles[1] ?? 0;
    g.drawImage(atlas, (t % ATLAS_COLS) * TILE_SIZE, Math.floor(t / ATLAS_COLS) * TILE_SIZE, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
  } else {
    SPRITES[id]?.((x, y, col) => {
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    });
  }
  cache.set(id, c);
  return c;
}

/** A fresh canvas element showing an item, for putting in the page. */
export function iconElement(id: number, className = "icon"): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = TILE_SIZE;
  c.className = className;
  c.getContext("2d")!.drawImage(itemIcon(id), 0, 0);
  return c;
}
