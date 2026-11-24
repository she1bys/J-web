import { describe, expect, it } from "vitest";
import { MATERIALS, SOUNDS } from "../src/audio/sounds";
import { BLOCKS } from "../src/game/world/blocks";

describe("sound designs", () => {
  it("every material has step, hit, break and place sounds", () => {
    for (const m of MATERIALS) for (const k of ["step", "hit", "break", "place"]) expect(SOUNDS[`${k}.${m}`], `${k}.${m}`).toBeDefined();
  });

  it("every block's material has sounds", () => {
    for (const b of BLOCKS) if (b) expect(SOUNDS[`step.${b.sound}`], b.name).toBeDefined();
  });

  it("designs have sensible lengths, variants and volumes", () => {
    for (const [name, s] of Object.entries(SOUNDS)) {
      expect(s.seconds, name).toBeGreaterThan(0.05);
      expect(s.seconds, name).toBeLessThanOrEqual(2);
      expect(s.variants, name).toBeGreaterThanOrEqual(1);
      expect(s.volume, name).toBeGreaterThan(0);
      expect(s.volume, name).toBeLessThanOrEqual(1);
    }
  });
});
