import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "../src/config/settings";

/** A tiny in-memory localStorage for node. */
beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

describe("settings", () => {
  it("starts with retro pixels off", () => {
    expect(DEFAULT_SETTINGS.retro).toBe(false);
    expect(loadSettings().retro).toBe(false);
  });

  it("switches retro off once for players who saved it before", () => {
    localStorage.setItem("joana.settings", JSON.stringify({ retro: true, look: 7 }));
    const s = loadSettings();
    expect(s.retro).toBe(false);
    expect(s.look).toBe(7);
  });

  it("respects turning it back on afterwards", () => {
    saveSettings({ ...DEFAULT_SETTINGS, retro: true });
    expect(loadSettings().retro).toBe(true);
  });
});
