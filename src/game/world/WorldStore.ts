import { GAME } from "../../config/game";
import { readJSON, writeJSON, removeKey } from "../../core/storage";

/** What is remembered about a map between visits. */
export interface MapSave {
  v: 1;
  /** Player changes as a flat list: [index, blockId, index, blockId, ...] */
  edits: number[];
  player?: { x: number; y: number; z: number; yaw: number; pitch: number };
  /** Indices of the hidden letters already collected. */
  letters: number[];
  /** Time of day, 0–1. */
  time?: number;
}

const key = (mapId: string) => `${GAME.storagePrefix}.map.${mapId}`;

export function loadMapSave(mapId: string): MapSave | null {
  const s = readJSON<MapSave | null>(key(mapId), null);
  return s && s.v === 1 ? s : null;
}

export function saveMapSave(mapId: string, save: MapSave): void {
  writeJSON(key(mapId), save);
}

export function clearMapSave(mapId: string): void {
  removeKey(key(mapId));
}
