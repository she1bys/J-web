/**
 * Songs added from the player's own device, kept in this browser (IndexedDB).
 * They are never uploaded anywhere. Every call fails soft: if storage is
 * unavailable, the game simply has no device songs.
 */
export interface StoredSong {
  id: number;
  name: string;
  blob: Blob;
}

const DB_NAME = "joana-music";
const STORE = "songs";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) return reject(new Error("no IndexedDB"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then(
    db =>
      new Promise<T | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(req ? req.result : undefined);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

export async function loadDeviceSongs(): Promise<StoredSong[]> {
  try {
    return ((await run<StoredSong[]>("readonly", s => s.getAll())) ?? []).filter(s => s.blob instanceof Blob);
  } catch {
    return [];
  }
}

/** Save audio files picked by the player. Returns how many were saved. */
export async function addDeviceSongs(files: Iterable<File>): Promise<number> {
  const audio = [...files].filter(f => f.type.startsWith("audio/") || /\.(mp3|m4a|aac|ogg|opus|wav|webm|flac)$/i.test(f.name));
  if (!audio.length) return 0;
  try {
    await run("readwrite", s => {
      for (const f of audio) s.add({ name: songTitle(f.name), blob: f });
    });
    return audio.length;
  } catch {
    return 0;
  }
}

export async function clearDeviceSongs(): Promise<void> {
  try {
    await run("readwrite", s => s.clear());
  } catch {
    /* nothing stored */
  }
}

/** "music/our-song_v2.mp3" -> "our song v2" */
export function songTitle(path: string): string {
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim() || "Untitled";
}
