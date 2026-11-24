export type GameMode = "survival" | "creative";

/** What each mode allows. */
export interface ModeRules {
  /** Health, hunger, air and damage. */
  vitals: boolean;
  instantMine: boolean;
  /** Placing blocks doesn't use them up. */
  infiniteBlocks: boolean;
  flight: boolean;
  /** Mined blocks drop items. */
  drops: boolean;
}

export const MODE_RULES: Record<GameMode, ModeRules> = {
  survival: { vitals: true, instantMine: false, infiniteBlocks: false, flight: false, drops: true },
  creative: { vitals: false, instantMine: true, infiniteBlocks: true, flight: true, drops: false },
};

export const MODE_NAMES: Record<GameMode, string> = { survival: "Survival", creative: "Creative" };

export function parseMode(s: string): GameMode | null {
  const k = s.trim().toLowerCase();
  if (["survival", "s", "0"].includes(k)) return "survival";
  if (["creative", "c", "1"].includes(k)) return "creative";
  return null;
}
