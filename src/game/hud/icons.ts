/**
 * Small pixel icons for the vitals bars, drawn from bitmaps (original art).
 * Returned as data URLs for use as CSS backgrounds.
 */
const HEART = [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."];
const FOOD = ["...#...", "..##...", ".#####.", "#######", "#######", ".#####.", "..###.."];
const BUBBLE = [".###.", "#..##", "#...#", "#...#", ".###."];

const cache = new Map<string, string>();

function draw(rows: string[], fill: string, edge: string, mode: "full" | "half" | "empty"): string {
  const key = rows.join("") + fill + edge + mode;
  const hit = cache.get(key);
  if (hit) return hit;
  const w = rows[0].length + 2;
  const h = rows.length + 2;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const on = (x: number, y: number) => rows[y - 1]?.[x - 1] === "#";
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (on(x, y)) {
        const filled = mode === "full" || (mode === "half" && x <= Math.ceil(w / 2) - 1);
        g.fillStyle = filled ? fill : "#d9d9d9";
        g.fillRect(x, y, 1, 1);
      } else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) {
        g.fillStyle = edge;
        g.fillRect(x, y, 1, 1);
      }
    }
  }
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

export const heartIcon = (mode: "full" | "half" | "empty") => draw(HEART, "#ff3d6e", "#000", mode);
export const foodIcon = (mode: "full" | "half" | "empty") => draw(FOOD, "#d8303a", "#000", mode);
export const bubbleIcon = () => draw(BUBBLE, "#8fd0ff", "#1d4f8f", "full");
