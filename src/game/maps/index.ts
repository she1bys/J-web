import type { MapDefinition } from "./types";
import { meadow } from "./meadow";
import { desert } from "./desert";
import { snowyPeaks } from "./snowyPeaks";
import { sunsetIslands } from "./sunsetIslands";
import { flatlands } from "./flatlands";

/** Every playable map, in the order shown on the map select screen. */
export const MAPS: readonly MapDefinition[] = [meadow, desert, snowyPeaks, sunsetIslands, flatlands];

export function getMap(id: string): MapDefinition {
  return MAPS.find(m => m.id === id) ?? MAPS[0];
}

export type { MapDefinition } from "./types";
