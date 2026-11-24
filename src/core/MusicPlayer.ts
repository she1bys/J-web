import { songTitle, loadDeviceSongs } from "./songStore";

export interface Track {
  title: string;
  url: string;
  /** "game": bundled in src/assets/music · "device": added by the player, stays on their device */
  source: "game" | "device";
}

/** Every audio file in src/assets/music is bundled with the game automatically. */
const GAME_SONGS = import.meta.glob("../assets/music/*.{mp3,m4a,aac,ogg,opus,wav,webm}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export function gameTracks(): Track[] {
  return Object.entries(GAME_SONGS)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, url]) => ({ title: songTitle(path), url, source: "game" as const }));
}

/**
 * Plays the game's songs plus any added from the player's device, shuffled,
 * moving on to the next one when a song ends. Uses a plain <audio> element,
 * so long songs stream instead of loading fully into memory.
 */
export class MusicPlayer {
  enabled = true;
  /** Called when the track list or the current song changes (to refresh menus). */
  onChange: (() => void) | null = null;
  private audio = new Audio();
  private tracks: Track[] = [];
  private order: number[] = [];
  private pos = -1;
  private wanted = false;
  private unlocked = false;
  private failures = 0;
  private deviceUrls: string[] = [];

  constructor() {
    this.audio.preload = "auto";
    this.audio.addEventListener("ended", () => this.next());
    this.audio.addEventListener("playing", () => {
      this.failures = 0;
    });
    this.audio.addEventListener("error", () => {
      // Skip songs that can't be played, but stop if nothing works.
      if (++this.failures < this.tracks.length) this.next();
    });
  }

  get current(): Track | null {
    return this.pos >= 0 ? this.tracks[this.order[this.pos]] ?? null : null;
  }

  get count(): { game: number; device: number } {
    return {
      game: this.tracks.filter(t => t.source === "game").length,
      device: this.tracks.filter(t => t.source === "device").length,
    };
  }

  /** (Re)load the playlist: game songs plus the player's own. */
  async load(): Promise<void> {
    this.deviceUrls.forEach(u => URL.revokeObjectURL(u));
    const device = await loadDeviceSongs();
    this.deviceUrls = device.map(s => URL.createObjectURL(s.blob));
    const playingUrl = this.current?.url;
    this.tracks = [
      ...gameTracks(),
      ...device.map((s, i): Track => ({ title: s.name, url: this.deviceUrls[i], source: "device" })),
    ];
    this.shuffle();
    if (playingUrl && !this.tracks.some(t => t.url === playingUrl)) {
      this.audio.removeAttribute("src");
      this.audio.load();
      this.pos = -1;
    }
    this.apply();
    this.onChange?.();
  }

  /** Call from a tap/click/key: browsers only allow sound after a user gesture. */
  unlock(): void {
    this.unlocked = true;
    if (this.audio.paused) this.apply();
  }

  setPlaying(on: boolean): void {
    this.wanted = on;
    this.apply();
  }

  /** 0 to 1 */
  setVolume(v: number): void {
    this.audio.volume = Math.max(0, Math.min(1, v));
  }

  next(): void {
    if (!this.tracks.length) return;
    this.pos++;
    if (this.pos >= this.order.length) {
      this.shuffle();
      this.pos = 0;
    }
    this.audio.src = this.tracks[this.order[this.pos]].url;
    this.apply();
    this.onChange?.();
  }

  private shuffle(): void {
    this.order = this.tracks.map((_, i) => i);
    for (let i = this.order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
    }
  }

  private apply(): void {
    const play = this.enabled && this.wanted && this.unlocked && this.tracks.length > 0;
    if (!play) {
      this.audio.pause();
      return;
    }
    if (this.pos < 0 || !this.audio.src) {
      this.next();
      return;
    }
    this.audio.play().catch(() => {
      /* blocked until the next tap; unlock() will retry */
    });
  }
}
