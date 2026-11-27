import { beforeEach, describe, expect, it } from "vitest";
import { createWorld, deleteWorld, listWorlds, loadWorld, saveWorld } from "../src/game/world/WorldStore";
import { importWorldFile, worldToFile } from "../src/game/world/worldFiles";

beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

describe("world files", () => {
  it("exports a world and imports it back with everything built", async () => {
    const w = createWorld({ name: "Our place", mapId: "meadow", mode: "survival", seed: 42 });
    saveWorld(w.id, { v: 2, mode: "survival", edits: [10, 8, 11, 8], inventory: [[1, 5]] });
    const file = worldToFile(w.id)!;
    expect(file.name).toBe("Our-place.gracia");
    deleteWorld(w.id);
    expect(listWorlds()).toHaveLength(0);

    const back = await importWorldFile(file);
    expect(back.name).toBe("Our place");
    expect(back.seed).toBe(42);
    expect(loadWorld(back.id)?.edits).toEqual([10, 8, 11, 8]);
  });

  it("renames an import that would clash with an existing world", async () => {
    const w = createWorld({ name: "Home", mapId: "desert", mode: "creative", seed: 1 });
    const back = await importWorldFile(worldToFile(w.id)!);
    expect(back.name).toBe("Home (copy)");
  });

  it("rejects files that aren't worlds", async () => {
    await expect(importWorldFile(new File(["hello"], "x.gracia"))).rejects.toThrow(/isn't a Gracia world/);
    await expect(importWorldFile(new File([JSON.stringify({ format: "other" })], "x.gracia"))).rejects.toThrow();
  });
});
