import { describe, expect, it } from "vitest";
import { GLYPHS, GLYPH_HEIGHT, textToRows } from "../src/fonts/pixelFont";

describe("pixel font", () => {
  it("has well-formed glyphs for A–Z and 0–9", () => {
    for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") {
      const g = GLYPHS[ch];
      expect(g, ch).toBeDefined();
      expect(g.length).toBe(GLYPH_HEIGHT);
      for (const row of g) {
        expect(row.length).toBe(g[0].length);
        expect(row).toMatch(/^[#.]+$/);
      }
    }
  });

  it("lays out a word with one-pixel gaps", () => {
    const rows = textToRows("GRACIA");
    expect(rows).toHaveLength(7);
    expect(rows[0].length).toBe(6 * 6 + 5);
  });

  it("treats unknown characters as spaces", () => {
    expect(textToRows("A?")[0].length).toBe(6 + 1 + 3);
  });
});
