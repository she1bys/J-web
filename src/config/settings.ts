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
  retro: true,
  trail: true,
  intro: true,
  sound: true,
  music: true,
  musicVolume: 6,
  dayCycle: true,
  showFps: false,
};

const KEY = `${GAME.storagePrefix}.settings`;

export function loadSettings(): Settings {
  const saved = readJSON<Partial<Settings>>(KEY, {});
  return { ...DEFAULT_SETTINGS, ...saved };
}

export function saveSettings(settings: Settings): void {
  writeJSON(KEY, settings);
}
