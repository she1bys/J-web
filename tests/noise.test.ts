import { describe, expect, it } from "vitest";
import { fbm2, valueNoise2 } from "../src/core/noise";
import { createRng } from "../src/core/random";

describe("noise", () => {
  it("is deterministic and stays in [0, 1]", () => {
    for (let i = 0; i < 200; i++) {
      const x = i * 0.37;
      const z = i * 0.91;
      const a = valueNoise2(x, z, 4);
      expect(a).toBe(valueNoise2(x, z, 4));
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
      const f = fbm2(x, z, 9, 4);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });

  it("seeded rng repeats exactly", () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 50; i++) expect(a()).toBe(b());
  });
});
