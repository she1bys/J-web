/**
 * Every sound in the game, designed from the building blocks in synth.ts.
 * Each design is rendered several times with different random details, so repeated
 * sounds (footsteps, mining) never sound identical.
 */
import { bell, click, crunch, grain, modes, sweep, swoosh, type Voice } from "./synth";

export type Material = "grass" | "dirt" | "stone" | "wood" | "sand" | "snow" | "glass" | "water" | "leaves";
export const MATERIALS: readonly Material[] = ["grass", "dirt", "stone", "wood", "sand", "snow", "glass", "water", "leaves"];

export interface SoundDesign {
  seconds: number;
  variants: number;
  /** Overall loudness when played. */
  volume: number;
  /** Random pitch spread when played (0.08 = ±4%). */
  pitch: number;
  design: (v: Voice) => void;
}

type Strength = { grains: number; gain: number; tail: number };
const STEP: Strength = { grains: 1, gain: 0.55, tail: 0 };
const HIT: Strength = { grains: 0.7, gain: 0.75, tail: 0 };
const BREAK: Strength = { grains: 2.2, gain: 1, tail: 1 };
const PLACE: Strength = { grains: 0.8, gain: 0.9, tail: 0 };

/** The core character of each material, scaled by how hard it's struck. */
function material(m: Material, s: Strength, place = false) {
  return (v: Voice) => {
    const r = v.rng;
    const g = s.gain;
    const n = (k: number) => Math.max(1, Math.round(k * s.grains));
    // Placing a block: a soft, low "set down" thump under every material.
    if (place) sweep(v, 0, 150, 60, 0.09, 0.55 * g);
    switch (m) {
      case "grass":
        crunch(v, 0, 0.1, n(8), [1600, 4200], 0.9, [0.18 * g, 0.4 * g], [0.012, 0.03]);
        sweep(v, 0, 120, 55, 0.07, 0.25 * g);
        break;
      case "leaves":
        crunch(v, 0, 0.18, n(14), [2500, 7000], 0.5, [0.1 * g, 0.24 * g], [0.015, 0.035]);
        break;
      case "dirt":
        crunch(v, 0, 0.09, n(7), [600, 1800], 1.2, [0.25 * g, 0.45 * g], [0.012, 0.03]);
        sweep(v, 0, 95, 45, 0.08, 0.4 * g);
        break;
      case "sand":
        crunch(v, 0, 0.13, n(16), [2600, 7500], 0.6, [0.1 * g, 0.22 * g], [0.006, 0.02]);
        sweep(v, 0, 90, 50, 0.06, 0.18 * g);
        break;
      case "snow":
        crunch(v, 0, 0.15, n(12), [1100, 3200], 0.8, [0.16 * g, 0.32 * g], [0.012, 0.03]);
        crunch(v, 0.02, 0.1, n(5), [500, 900], 1.5, [0.12 * g, 0.2 * g], [0.02, 0.04]);
        break;
      case "stone":
        click(v, 0, 0.5 * g);
        modes(v, 0, [
          [900 + r() * 500, 0.03, 0.25 * g],
          [2200 + r() * 900, 0.018, 0.13 * g],
          [3900 + r() * 900, 0.01, 0.06 * g],
        ]);
        sweep(v, 0, 150, 80, 0.05, 0.35 * g);
        crunch(v, 0, 0.04, n(3), [2500, 5000], 1, [0.1 * g, 0.18 * g], [0.006, 0.012]);
        break;
      case "wood":
        click(v, 0, 0.32 * g, 2500);
        modes(v, 0, [
          [175 + r() * 40, 0.11, 0.42 * g],
          [395 + r() * 60, 0.07, 0.26 * g],
          [820 + r() * 90, 0.035, 0.13 * g],
          [1500 + r() * 150, 0.02, 0.05 * g],
        ]);
        break;
      case "glass":
        click(v, 0, 0.25 * g, 6000);
        modes(v, 0, [
          [2350 + r() * 300, 0.16, 0.16 * g],
          [3850 + r() * 500, 0.11, 0.11 * g],
          [6100 + r() * 500, 0.07, 0.07 * g],
        ], 0.02);
        break;
      case "water":
        swoosh(v, 0, 0.16, 450, 1500, 0.35 * g, 1.4);
        for (let i = 0; i < 2 + Math.round(r()); i++) sweep(v, 0.02 + r() * 0.1, 400 + r() * 300, 1100 + r() * 600, 0.04, 0.12 * g);
        break;
    }
    if (s.tail) {
      // Breaking: bits of debris pattering down after the impact.
      const debris: [number, number] = m === "glass" ? [3000, 8000] : m === "wood" ? [500, 1800] : m === "stone" ? [1500, 4500] : [900, 3500];
      crunch(v, 0.06, 0.32, n(5), debris, 1.1, [0.06, 0.16], [0.008, 0.025]);
      if (m === "glass") {
        // Shatter: many tiny high rings
        for (let i = 0; i < 14; i++) modes(v, r() * 0.25, [[2600 + r() * 6000, 0.05 + r() * 0.1, 0.04 + r() * 0.05]], 0);
      }
      if (m === "wood") for (let i = 0; i < 4; i++) click(v, r() * 0.05, 0.2, 1800);
    }
  };
}

export const SOUNDS: Record<string, SoundDesign> = {};

for (const m of MATERIALS) {
  SOUNDS[`step.${m}`] = { seconds: 0.3, variants: 6, volume: 0.5, pitch: 0.14, design: material(m, STEP) };
  SOUNDS[`hit.${m}`] = { seconds: 0.3, variants: 4, volume: 0.6, pitch: 0.12, design: material(m, HIT) };
  SOUNDS[`break.${m}`] = { seconds: 0.6, variants: 3, volume: 0.9, pitch: 0.1, design: material(m, BREAK) };
  SOUNDS[`place.${m}`] = { seconds: 0.3, variants: 3, volume: 0.75, pitch: 0.1, design: material(m, PLACE, true) };
}

Object.assign(SOUNDS, {
  /* ---------- Interface ---------- */
  click: {
    seconds: 0.12, variants: 2, volume: 0.45, pitch: 0.05,
    design: v => {
      sweep(v, 0, 1250, 1050, 0.035, 0.22);
      sweep(v, 0, 2500, 2100, 0.02, 0.06);
      click(v, 0, 0.05, 6000);
    },
  },
  open: {
    seconds: 0.3, variants: 1, volume: 0.5, pitch: 0,
    design: v => {
      swoosh(v, 0, 0.16, 500, 2400, 0.22, 0.9);
      sweep(v, 0.05, 660, 990, 0.12, 0.08);
    },
  },
  close: {
    seconds: 0.3, variants: 1, volume: 0.45, pitch: 0,
    design: v => {
      swoosh(v, 0, 0.14, 2200, 450, 0.18, 0.9);
      sweep(v, 0.03, 880, 590, 0.1, 0.06);
    },
  },
  pickup: {
    seconds: 0.25, variants: 3, volume: 0.45, pitch: 0.12,
    design: v => {
      sweep(v, 0, 520, 1050, 0.07, 0.24, "sine", 0.003);
      sweep(v, 0.01, 1040, 2100, 0.05, 0.06);
    },
  },
  drop: {
    seconds: 0.2, variants: 2, volume: 0.4, pitch: 0.08,
    design: v => {
      sweep(v, 0, 720, 380, 0.07, 0.2);
      grain(v, 0, 0.02, 1500, 1, 0.08);
    },
  },
  error: {
    seconds: 0.3, variants: 1, volume: 0.4, pitch: 0,
    design: v => {
      sweep(v, 0, 230, 220, 0.07, 0.25, "triangle");
      sweep(v, 0.1, 190, 180, 0.09, 0.25, "triangle");
    },
  },
  craft: {
    seconds: 1.1, variants: 2, volume: 0.55, pitch: 0.03,
    design: v => {
      // A wooden knock, then a soft three-note chime
      modes(v, 0, [[200, 0.08, 0.3], [430, 0.05, 0.15]]);
      bell(v, 0.05, 784, 0.12, 0.7);
      bell(v, 0.12, 988, 0.1, 0.65);
      bell(v, 0.19, 1319, 0.09, 0.6);
    },
  },
  respawn: {
    seconds: 1.2, variants: 1, volume: 0.5, pitch: 0,
    design: v => {
      [523, 659, 784, 1047].forEach((f, i) => bell(v, i * 0.09, f, 0.09, 0.6));
    },
  },

  /* ---------- Player ---------- */
  eat: {
    seconds: 0.7, variants: 3, volume: 0.6, pitch: 0.1,
    design: v => {
      for (let i = 0; i < 3; i++) {
        const t = i * 0.17 + v.rng() * 0.02;
        crunch(v, t, 0.07, 7, [700, 2600], 1.1, [0.15, 0.35], [0.01, 0.03]);
        sweep(v, t, 140, 80, 0.05, 0.15);
      }
    },
  },
  hurt: {
    seconds: 0.4, variants: 3, volume: 0.75, pitch: 0.08,
    design: v => {
      sweep(v, 0, 190, 70, 0.16, 0.6);
      grain(v, 0, 0.08, 900, 0.7, 0.35, "lowpass");
      sweep(v, 0.01, 420, 260, 0.1, 0.12, "triangle");
    },
  },
  death: {
    seconds: 1.4, variants: 1, volume: 0.7, pitch: 0,
    design: v => {
      sweep(v, 0, 330, 70, 1.1, 0.35, "triangle", 0.02);
      sweep(v, 0, 165, 45, 1.2, 0.3);
      swoosh(v, 0, 0.8, 900, 200, 0.12, 0.8);
    },
  },
  land: {
    seconds: 0.35, variants: 3, volume: 0.6, pitch: 0.08,
    design: v => {
      sweep(v, 0, 110, 45, 0.13, 0.6);
      crunch(v, 0, 0.06, 6, [500, 1600], 1.1, [0.1, 0.25], [0.01, 0.03]);
    },
  },
  splash: {
    seconds: 1, variants: 2, volume: 0.75, pitch: 0.08,
    design: v => {
      swoosh(v, 0, 0.5, 300, 1200, 0.45, 0.8);
      swoosh(v, 0.08, 0.6, 1800, 500, 0.2, 1.2);
      for (let i = 0; i < 9; i++) {
        const t = 0.05 + v.rng() * 0.6;
        sweep(v, t, 350 + v.rng() * 500, 900 + v.rng() * 900, 0.03 + v.rng() * 0.03, 0.06 + v.rng() * 0.06);
      }
    },
  },
  toolBreak: {
    seconds: 0.6, variants: 1, volume: 0.7, pitch: 0.05,
    design: v => {
      for (let i = 0; i < 6; i++) click(v, i * 0.012 + v.rng() * 0.01, 0.3, 2000);
      modes(v, 0, [[310, 0.08, 0.3], [720, 0.05, 0.2], [1460, 0.03, 0.1]]);
      crunch(v, 0.04, 0.25, 6, [900, 3000], 1, [0.05, 0.12], [0.008, 0.02]);
    },
  },
} satisfies Record<string, SoundDesign>);

export type SoundName = keyof typeof SOUNDS;
