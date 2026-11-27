import { GAME } from "../../config/game";
import { readJSON, writeJSON, removeKey } from "../../core/storage";
import type { GameMode } from "../modes";
import type { SavedInventory } from "../items/Inventory";

/**
 * Saved worlds, kept in this browser. A small index lists every world (for the
 * world select screen); each world's contents are stored under their own key.
 */
export interface WorldMeta {
  id: string;
  name: string;
  /** Which map generator built it (see game/maps). */
  mapId: string;
  /** Mode the world was created in (can change in game with /gamemode). */
  mode: GameMode;
  seed: number;
  created: number;
  lastPlayed: number;
}

export interface WorldRules {
  keepInventory: boolean;
  dayCycle: boolean;
}

export interface WorldSave {
  v: 2;
  mode: GameMode;
  /** Player changes as a flat list: [index, blockId, index, blockId, ...] */
  edits: number[];
  player?: { x: number; y: number; z: number; yaw: number; pitch: number; flying?: boolean };
  /** Time of day, 0–1. */
  time?: number;
  inventory?: SavedInventory;
  vitals?: { health: number; hunger: number; air: number };
  spawn?: { x: number; y: number; z: number };
  rules?: WorldRules;
  selectedSlot?: number;
  /** Chest contents, keyed by block index. */
  chests?: Record<string, SavedInventory>;
}

export const DEFAULT_RULES: WorldRules = { keepInventory: false, dayCycle: true };

const INDEX = `${GAME.storagePrefix}.worlds`;
const dataKey = (id: string) => `${GAME.storagePrefix}.world.${id}`;

export function listWorlds(): WorldMeta[] {
  return readJSON<WorldMeta[]>(INDEX, []).sort((a, b) => b.lastPlayed - a.lastPlayed);
}

function writeIndex(list: WorldMeta[]): void {
  writeJSON(INDEX, list);
}

export function getWorld(id: string): WorldMeta | undefined {
  return listWorlds().find(w => w.id === id);
}

export function createWorld(fields: Pick<WorldMeta, "name" | "mapId" | "mode" | "seed">): WorldMeta {
  const now = Date.now();
  const meta: WorldMeta = {
    ...fields,
    name: fields.name.trim().slice(0, 32) || "New world",
    id: `${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    created: now,
    lastPlayed: now,
  };
  writeIndex([meta, ...listWorlds()]);
  return meta;
}

export function updateWorldMeta(id: string, patch: Partial<WorldMeta>): void {
  writeIndex(listWorlds().map(w => (w.id === id ? { ...w, ...patch } : w)));
}

export function deleteWorld(id: string): void {
  writeIndex(listWorlds().filter(w => w.id !== id));
  removeKey(dataKey(id));
}

export function loadWorld(id: string): WorldSave | null {
  const s = readJSON<WorldSave | null>(dataKey(id), null);
  return s && s.v === 2 ? s : null;
}

export function saveWorld(id: string, save: WorldSave): void {
  writeJSON(dataKey(id), save);
}

/** Turn saves from the older one-save-per-map version into worlds, once. */
export function migrateLegacySaves(maps: readonly { id: string; name: string; seed: number }[]): void {
  const done = `${GAME.storagePrefix}.migrated`;
  if (readJSON(done, false)) return;
  for (const m of maps) {
    const key = `${GAME.storagePrefix}.map.${m.id}`;
    const old = readJSON<{ v: 1; edits: number[]; player?: WorldSave["player"]; letters: number[]; time?: number } | null>(key, null);
    if (!old || old.v !== 1) continue;
    const meta = createWorld({ name: m.name, mapId: m.id, mode: "creative", seed: m.seed });
    saveWorld(meta.id, { v: 2, mode: "creative", edits: old.edits, player: old.player, time: old.time });
    removeKey(key);
  }
  writeJSON(done, true);
}

export const randomSeed = (): number => Math.floor(Math.random() * 2_000_000_000);

/** Turn typed text into a seed: numbers are used as-is, words are hashed. */
export function seedFromText(text: string): number {
  const t = text.trim();
  if (!t) return randomSeed();
  if (/^-?\d+$/.test(t)) return Number(t) | 0;
  let h = 0;
  for (const ch of t) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return h;
}
