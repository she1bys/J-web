import { describe, expect, it } from "vitest";
import { Vitals, MAX_HEALTH } from "../src/game/survival/Vitals";

const idle = { sprinting: false, moving: false, submerged: false };

describe("Vitals", () => {
  it("fall damage starts after 3 blocks", () => {
    const v = new Vitals();
    expect(v.fall(3)).toBe(0);
    expect(v.fall(7)).toBe(4);
    expect(v.health).toBe(MAX_HEALTH - 4);
  });

  it("runs out of air under water, then drowns", () => {
    const v = new Vitals();
    for (let i = 0; i < 10 * 60; i++) v.update(1 / 60, { ...idle, submerged: true });
    expect(v.air).toBe(0);
    let hurt = 0;
    for (let i = 0; i < 3 * 60; i++) hurt += v.update(1 / 60, { ...idle, submerged: true });
    expect(hurt).toBeGreaterThan(0);
  });

  it("gets hungry over time, faster when sprinting", () => {
    const a = new Vitals();
    const b = new Vitals();
    for (let i = 0; i < 120 * 10; i++) {
      a.update(0.1, idle);
      b.update(0.1, { ...idle, sprinting: true });
    }
    expect(a.hunger).toBeLessThan(20);
    expect(b.hunger).toBeLessThan(a.hunger);
  });

  it("heals when well fed and eating fills hunger", () => {
    const v = new Vitals();
    v.damage(6, "fall");
    for (let i = 0; i < 20 * 10; i++) v.update(0.1, idle);
    expect(v.health).toBeGreaterThan(MAX_HEALTH - 6);
    v.hunger = 10;
    expect(v.eat(4)).toBe(true);
    expect(v.hunger).toBe(14);
  });

  it("dies at zero health", () => {
    const v = new Vitals();
    v.damage(100, "void");
    expect(v.dead).toBe(true);
    expect(Vitals.deathMessage(v.lastCause)).toMatch(/out of the world/);
  });
});
