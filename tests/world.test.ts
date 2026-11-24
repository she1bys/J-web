import { describe, expect, it } from "vitest";
import { World } from "../src/game/world/World";
import { Block } from "../src/game/world/blocks";
import { raycast } from "../src/game/world/raycast";
import { Player } from "../src/game/player/Player";

describe("World", () => {
  it("stores blocks and records only player edits", () => {
    const w = new World(8, 8, 8);
    w.set(1, 2, 3, Block.Stone);
    expect(w.get(1, 2, 3)).toBe(Block.Stone);
    expect(w.edits.size).toBe(0);
    w.recording = true;
    w.set(1, 2, 3, Block.Air);
    expect(w.edits.get(w.index(1, 2, 3))).toBe(Block.Air);
  });

  it("treats the world edges and floor as walls but water as passable", () => {
    const w = new World(4, 4, 4);
    expect(w.isSolid(-1, 1, 1)).toBe(true);
    expect(w.isSolid(1, -1, 1)).toBe(true);
    expect(w.isSolid(1, 10, 1)).toBe(false);
    w.set(1, 1, 1, Block.Water);
    expect(w.isSolid(1, 1, 1)).toBe(false);
  });

  it("re-applies saved edits", () => {
    const a = new World(4, 4, 4);
    a.recording = true;
    a.set(2, 2, 2, Block.Rose);
    const flat = [...a.edits].flat();
    const b = new World(4, 4, 4);
    b.applyEdits(flat);
    expect(b.get(2, 2, 2)).toBe(Block.Rose);
  });

  it("coords() inverts index()", () => {
    const w = new World(5, 6, 7);
    expect(w.coords(w.index(3, 4, 5))).toEqual([3, 4, 5]);
  });
});

describe("raycast", () => {
  it("hits the first block and reports the cell in front of it", () => {
    const w = new World(16, 16, 16);
    w.set(8, 5, 2, Block.Stone);
    const hit = raycast(w, { x: 8.5, y: 5.5, z: 10.5 }, { x: 0, y: 0, z: -1 }, 20);
    expect(hit).toMatchObject({ x: 8, y: 5, z: 2, px: 8, py: 5, pz: 3 });
  });

  it("passes through water and respects max distance", () => {
    const w = new World(16, 16, 16);
    w.set(8, 5, 6, Block.Water);
    w.set(8, 5, 2, Block.Stone);
    expect(raycast(w, { x: 8.5, y: 5.5, z: 10.5 }, { x: 0, y: 0, z: -1 }, 20)?.z).toBe(2);
    expect(raycast(w, { x: 8.5, y: 5.5, z: 10.5 }, { x: 0, y: 0, z: -1 }, 3)).toBeNull();
  });
});

describe("Player physics", () => {
  const still = { x: 0, z: 0, jump: false, sprint: false, descend: false };

  it("falls and lands on the ground", () => {
    const w = new World(8, 16, 8);
    w.fill(0, 0, 0, 7, 3, 7, Block.Stone);
    const p = new Player(w);
    p.pos.set(4.5, 10, 4.5);
    for (let i = 0; i < 120; i++) p.update(1 / 60, still, false);
    expect(p.onGround).toBe(true);
    expect(p.pos.y).toBeCloseTo(4, 3);
  });

  it("is stopped by walls", () => {
    const w = new World(8, 8, 8);
    w.fill(0, 0, 0, 7, 0, 7, Block.Stone);
    w.fill(0, 1, 2, 7, 4, 2, Block.Stone);
    const p = new Player(w);
    p.pos.set(4.5, 1, 5.5);
    for (let i = 0; i < 120; i++) p.update(1 / 60, { ...still, z: -1 }, false);
    expect(p.pos.z).toBeGreaterThan(3.29);
  });
});
