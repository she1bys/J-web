/** Small, fast, seedable random number generator (mulberry32). Returns values in [0, 1). */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randInt = (rng: Rng, min: number, maxInclusive: number): number =>
  min + Math.floor(rng() * (maxInclusive - min + 1));

export const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)];
