import { MAPS } from "../maps";
import { createWorld, getWorld, listWorlds, loadWorld, saveWorld, type WorldMeta, type WorldSave } from "./WorldStore";

/**
 * Worlds as files: export a copy to keep safe or move to another device, and import it back.
 * The file is plain JSON with a `.gracia` extension.
 */
interface WorldFile {
  format: "gracia-world";
  version: 1;
  exported: number;
  meta: Pick<WorldMeta, "name" | "mapId" | "mode" | "seed" | "created">;
  save: WorldSave | null;
}

const safeName = (s: string) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "world";

/** Build the file for a world. Synchronous, so it can be shared straight from a tap. */
export function worldToFile(id: string): File | null {
  const meta = getWorld(id);
  if (!meta) return null;
  const data: WorldFile = {
    format: "gracia-world",
    version: 1,
    exported: Date.now(),
    meta: { name: meta.name, mapId: meta.mapId, mode: meta.mode, seed: meta.seed, created: meta.created },
    save: loadWorld(id),
  };
  return new File([JSON.stringify(data)], `${safeName(meta.name)}.gracia`, { type: "application/json" });
}

/**
 * Hand the file to the player: the share sheet on phones (Save to Files, AirDrop, Messages…),
 * a normal download elsewhere. Call from a tap/click.
 */
export function shareOrDownload(file: File): void {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    nav.share({ files: [file], title: file.name }).catch(() => {});
    return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Read a world file and add it as a new world. Throws an Error with a friendly message. */
export async function importWorldFile(file: File): Promise<WorldMeta> {
  let data: WorldFile;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("That file isn't a Gracia world");
  }
  if (data?.format !== "gracia-world" || !data.meta) throw new Error("That file isn't a Gracia world");
  if (!MAPS.some(m => m.id === data.meta.mapId)) throw new Error("This world uses a map this version doesn't have");
  if (data.save && data.save.v !== 2) throw new Error("This world was saved by a newer version");
  const taken = new Set(listWorlds().map(w => w.name));
  let name = data.meta.name || "Imported world";
  if (taken.has(name)) name = `${name} (copy)`;
  const meta = createWorld({ name, mapId: data.meta.mapId, mode: data.meta.mode, seed: data.meta.seed });
  if (data.save) saveWorld(meta.id, data.save);
  return meta;
}

export const WORLD_FILE_ACCEPT = ".gracia,application/json";
