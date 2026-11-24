import type { Rng } from "../../core/random";
import type { GameMode } from "../modes";
import type { BlockId } from "../world/blocks";
import type { World } from "../world/World";

export interface Vec3 { x: number; y: number; z: number }

/** Colours used by the sky as the day goes by. */
export interface SkyPalette {
  day: number;
  night: number;
  /** Tint mixed in around sunrise and sunset. */
  dusk: number;
}

/** Everything the game needs to know about one map. Add a new map by creating one of these. */
export interface MapDefinition {
  /** Stable id, used for saving. Never change it once players have saved. */
  id: string;
  name: string;
  description: string;
  size: { x: number; y: number; z: number };
  /** Seed used for worlds made before seeds could be chosen. */
  seed: number;
  sky: SkyPalette;
  /** Fog start and end distance. */
  fog: [near: number, far: number];
  /** Blocks in the item bar (up to 9). */
  hotbar: BlockId[];
  /** Time of day to start at: 0 sunrise, 0.25 noon, 0.5 sunset, 0.75 midnight. */
  startTime: number;
  /** Mode suggested when creating a world on this map. */
  defaultMode?: GameMode;
  /** Fill the world with blocks and say where the player starts. */
  generate(world: World, ctx: GenerateContext): MapLayout;
}

export interface GenerateContext {
  /** The world's seed. Use it (plus offsets) for every noise call so each seed is different. */
  seed: number;
  rng: Rng;
}

export interface MapLayout {
  spawn: Vec3 & { yaw: number };
}
