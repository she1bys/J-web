import { GAME } from "./game";
import { readJSON, writeJSON } from "../core/storage";

export type CameraMode = "first" | "third";

export interface Settings {
  camera: CameraMode;
  /** Mouse/touch look speed, 1–10. */
  look: number;
  invertY: boolean;
  /** Render at low resolution with hard pixel edges. */
  retro: boolean;
  /** Grey pixel trail behind the cursor on the title screen. */
  trail: boolean;
  /** Play the sunset movie before entering a map. */
  intro: boolean;
  /** Sound effects (steps, mining, menus). */
  sound: boolean;
  music: boolean;
  /** Music volume, 0–10. */
  musicVolume: number;
  /** Let the sun rise and set while you play. */
  dayCycle: boolean;
  showFps: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  camera: "first",
  look: 5,
  invertY: false,
  retro: false,
  trail: true,
  intro: true,
  sound: true,
  music: true,
  musicVolume: 6,
  dayCycle: true,
  showFps: false,
};

const KEY = `${GAME.storagePrefix}.settings`;

/**
 * Bump when a default changes and existing players should get the new value once.
 * v2: retro pixels became off by default.
 */
const SETTINGS_VERSION = 2;

export function loadSettings(): Settings {
  const saved = readJSON<Partial<Settings> & { version?: number }>(KEY, {});
  const { version, ...rest } = saved;
  const settings = { ...DEFAULT_SETTINGS, ...rest };
  if ((version ?? 1) < 2) settings.retro = DEFAULT_SETTINGS.retro;
  if (version !== SETTINGS_VERSION) saveSettings(settings);
  return settings;
}

export function saveSettings(settings: Settings): void {
  writeJSON(KEY, { ...settings, version: SETTINGS_VERSION });
}
