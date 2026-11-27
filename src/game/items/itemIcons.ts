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
const IRON = ["#e4e4e8", "#9a9aa4"];
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

/** A blob filled from a distance function, for food and materials. */
const blob = (inside: (x: number, y: number) => boolean, color: (x: number, y: number) => string): Painter => put => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (inside(x, y)) put(x, y, color(x, y));
};

/** Sword: a diagonal blade, a crossguard and a short grip. */
const sword = ([light, dark]: string[]): Painter => put => {
  for (let i = 5; i <= 13; i++) {
    put(i, 15 - i, light);
    put(i + 1, 15 - i, dark);
    put(i, 16 - i, dark);
  }
  for (let k = -2; k <= 2; k++) put(5 + k, 10 + k, "#5a3a20"); // crossguard
  for (let i = 2; i <= 4; i++) put(i, 15 - i, HANDLE[0]);
  put(1, 14, HANDLE[1]);
};

/** Hoe: a handle with a small blade bent off the top. */
const HOE_HEAD: Px[] = [[9, 3], [10, 3], [11, 3], [12, 3], [9, 4], [10, 4], [11, 4], [12, 4], [12, 5], [12, 6]];

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
  [Item.IronPickaxe]: put => { handle(put, 10); head(PICK_HEAD, IRON)(put); },
  [Item.IronAxe]: put => { handle(put, 11); head(AXE_HEAD, IRON)(put); },
  [Item.IronShovel]: put => { handle(put, 9); head(SHOVEL_HEAD, IRON)(put); },
  [Item.WoodenSword]: sword(WOOD),
  [Item.StoneSword]: sword(STONE),
  [Item.IronSword]: sword(IRON),
  [Item.WoodenHoe]: put => { handle(put, 10); head(HOE_HEAD, WOOD)(put); },
  [Item.StoneHoe]: put => { handle(put, 10); head(HOE_HEAD, STONE)(put); },
  [Item.IronHoe]: put => { handle(put, 10); head(HOE_HEAD, IRON)(put); },
  [Item.Coal]: blob(
    (x, y) => Math.hypot((x - 7.5) * 1.1, (y - 8.5) * 0.95) < 5.2 + ((x * 7 + y * 3) % 5 === 0 ? -1 : 0),
    (x, y) => ((x + y) % 5 === 0 ? "#4a4a50" : y < 7 ? "#2e2e33" : "#1b1b1f"),
  ),
  [Item.IronIngot]: blob(
    (x, y) => y >= 6 && y <= 11 && x >= 2 + (11 - y) * 0.5 && x <= 13 - (11 - y) * 0.5,
    (_x, y) => (y === 6 ? "#f4f4f8" : y === 11 ? "#8a8a94" : "#c8c8d0"),
  ),
  [Item.Seeds]: put => {
    for (const [x, y] of [[4, 6], [7, 4], [10, 7], [5, 10], [9, 11], [12, 4], [3, 13], [11, 13], [7, 8]]) {
      put(x, y, "#c9b45a");
      put(x + 1, y, "#8fb84a");
    }
  },
  [Item.Wheat]: put => {
    for (const x of [5, 7, 9, 11]) {
      for (let y = 6; y < 15; y++) put(x, y, y % 3 === 0 ? "#a08a3a" : "#c9b45a");
      for (let y = 1; y < 6; y++) put(x + (y % 2), y, y % 2 ? "#e8c45a" : "#c9a23e");
    }
    for (let x = 4; x <= 12; x++) put(x, 10, "#7a5a2a");
  },
  [Item.Bread]: blob(
    (x, y) => Math.hypot((x - 7.5) / 1.5, (y - 9) / 0.85) < 4.6,
    (x, y) => (y < 7 ? "#e0a35a" : (x + y) % 6 === 0 ? "#f0c890" : y > 11 ? "#a8682e" : "#c98a45"),
  ),
  [Item.RawMeat]: blob(
    (x, y) => Math.hypot((x - 7.5) * 1.05, y - 8.5) < 5.4,
    (x, y) => ((x * 3 + y) % 7 === 0 ? "#f6d8d8" : y > 11 ? "#b8343e" : "#e0505c"),
  ),
  [Item.CookedMeat]: blob(
    (x, y) => Math.hypot((x - 7.5) * 1.05, y - 8.5) < 5.4,
    (x, y) => ((x * 3 + y) % 7 === 0 ? "#d8a070" : y > 11 ? "#5e3218" : "#8a4a24"),
  ),
  [Item.Fluff]: blob(
    (x, y) => Math.hypot(x - 5.5, y - 9) < 3.6 || Math.hypot(x - 10, y - 9) < 3.6 || Math.hypot(x - 8, y - 6) < 3.8,
    (x, y) => (y > 11 ? "#dcd6e8" : (x + y) % 7 === 0 ? "#ffd6e6" : "#ffffff"),
  ),
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
  const plantTile = def?.plants && !SPRITES[id] ? BLOCKS[def.plants.block]?.variants?.[def.plants.meta] : undefined;
  if (plantTile !== undefined) {
    // Saplings show their own little plant texture
    atlas ??= paintAtlas();
    g.drawImage(atlas, (plantTile % ATLAS_COLS) * TILE_SIZE, Math.floor(plantTile / ATLAS_COLS) * TILE_SIZE, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
  } else if (def?.block !== undefined) {
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
