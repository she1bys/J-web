import { describe, expect, it } from "vitest";
import { World } from "../src/game/world/World";
import { Block } from "../src/game/world/blocks";
import { Lighting } from "../src/game/world/Lighting";

const box = () => {
  const w = new World(32, 16, 32);
  w.fill(0, 0, 0, 31, 3, 31, Block.Stone);
  return w;
};

describe("lighting", () => {
  it("open sky is fully lit; a roof blocks sunlight", () => {
    const w = box();
    w.fill(10, 8, 10, 20, 8, 20, Block.Stone); // a roof
    const l = new Lighting(w);
    l.computeAll();
    expect(w.skyLight(2, 5, 2)).toBe(15);
    expect(w.skyLight(15, 5, 15)).toBeLessThan(15); // under the roof: only light spilling in from the sides
    expect(w.skyLight(15, 5, 15)).toBeGreaterThan(0);
  });

  it("a sealed room is dark until a torch is placed, and dark again when it's removed", () => {
    const w = box();
    w.fill(10, 4, 10, 16, 10, 16, Block.Stone);
    w.fill(11, 5, 11, 15, 9, 15, Block.Air);
    const l = new Lighting(w);
    l.computeAll();
    expect(w.skyLight(13, 6, 13)).toBe(0);
    expect(w.blockLight(13, 6, 13)).toBe(0);

    w.set(13, 5, 13, Block.Torch);
    const changed = l.update(13, 13);
    expect(changed.size).toBeGreaterThan(0);
    expect(w.blockLight(13, 5, 13)).toBe(14);
    expect(w.blockLight(14, 5, 13)).toBe(13);
    expect(w.blockLight(11, 5, 11)).toBe(10);

    w.set(13, 5, 13, Block.Air);
    l.update(13, 13);
    expect(w.blockLight(13, 5, 13)).toBe(0);
  });

  it("light falls off one level per block", () => {
    const w = new World(40, 4, 3);
    w.set(5, 1, 1, Block.Lantern);
    const l = new Lighting(w);
    l.computeAll();
    for (let d = 0; d < 10; d++) expect(w.blockLight(5 + d + 1, 1, 1)).toBe(15 - (d + 1));
  });
});
