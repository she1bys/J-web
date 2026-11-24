import { GAME } from "../config/game";
import { loadSettings, saveSettings, type Settings } from "../config/settings";
import { AudioEngine } from "../audio/AudioEngine";
import { MusicPlayer } from "../core/MusicPlayer";
import { addDeviceSongs, clearDeviceSongs } from "../core/songStore";
import { isIOS, isStandalone, isTouchDevice, prefersReducedMotion } from "../core/timeline";
import { readJSON, writeJSON } from "../core/storage";
import { Viewport } from "../core/viewport";
import { SunsetIntro } from "../cinematic/SunsetIntro";
import { Particles } from "../title/Particles";
import { PixelTrail } from "../title/PixelTrail";
import { TitleScreen } from "../title/TitleScreen";
import { Menu, button, input, text, title, type MenuItem } from "../ui/Menu";
import { MAPS, getMap } from "../game/maps";
import { MODE_NAMES, type GameMode } from "../game/modes";
import {
  createWorld, deleteWorld, listWorlds, migrateLegacySaves, seedFromText, type WorldMeta,
} from "../game/world/WorldStore";
import type { Game } from "../game/Game";

type Screen = "main" | "install" | "worlds" | "world" | "create" | "confirm-delete" | "settings" | "music" | "howto" | "credits" | "pause";

/** "just now", "5 min ago", "3 days ago" */
const ago = (t: number): string => {
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * The whole app as a small state machine:
 * title → menu → worlds (load or create) → break the name → intro movie → game ⇄ pause menu.
 */
export class App {
  private settings: Settings = loadSettings();
  private readonly audio = new AudioEngine();
  private readonly music = new MusicPlayer();
  private songPicker: HTMLInputElement;
  private readonly touch = isTouchDevice();
  private readonly reduce = prefersReducedMotion();

  private title: TitleScreen;
  private particles: Particles;
  private trail: PixelTrail;
  private intro: SunsetIntro;
  private viewport: Viewport;
  private titleMenu: Menu;
  private pauseMenu: Menu;

  private hintEl: HTMLElement;
  private menuEl: HTMLElement;
  private nameEl: HTMLElement;
  private playLayer: HTMLElement;
  private gameEl: HTMLElement;
  private pauseEl: HTMLElement;

  private stack: Screen[] = ["main"];
  private menuOpen = false;
  private busy = true;
  private game: Game | null = null;
  /** World picked on the worlds screen. */
  private selected: WorldMeta | null = null;
  /** The "New world" form. */
  private draft: { name: string; map: number; mode: GameMode; seed: string } = { name: "", map: 0, mode: "survival", seed: "" };

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <canvas class="fx-trail" aria-hidden="true"></canvas>
      <canvas class="fx-debris" aria-hidden="true"></canvas>
      <main class="title-stage">
        <h1 class="name"></h1>
        <p class="hint off"></p>
        <nav class="menu" hidden></nav>
      </main>
      <div class="play-layer" hidden>
        <div class="game"></div>
        <div class="pause" hidden><nav class="menu"></nav></div>
      </div>`;
    const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
    this.nameEl = $(".name");
    this.hintEl = $(".hint");
    this.menuEl = $(".title-stage .menu");
    this.playLayer = $(".play-layer");
    this.gameEl = $(".game");
    this.pauseEl = $(".pause");

    this.particles = new Particles($(".fx-debris"));
    this.trail = new PixelTrail($(".fx-trail"));
    this.title = new TitleScreen(this.nameEl, $(".title-stage"), this.particles);
    this.intro = new SunsetIntro(root);
    this.viewport = new Viewport(this.playLayer);
    const click = () => this.audio.click();
    this.titleMenu = new Menu(this.menuEl, click);
    this.pauseMenu = new Menu(this.pauseEl.querySelector(".menu")!, click);

    // Hidden file picker for "Add songs from device".
    this.songPicker = document.createElement("input");
    this.songPicker.type = "file";
    this.songPicker.accept = "audio/*";
    this.songPicker.multiple = true;
    this.songPicker.hidden = true;
    root.appendChild(this.songPicker);
    this.songPicker.addEventListener("change", () => void this.addSongs());

    this.applyAudioSettings();
    this.music.onChange = () => {
      if (this.stack[this.stack.length - 1] === "music") this.render(false, this.menu.focusedIndex());
    };
    void this.music.load();
    migrateLegacySaves(MAPS);
    this.bindGlobalEvents();
    void this.start();
  }

  private async start(): Promise<void> {
    this.title.build(GAME.title);
    this.resize();
    await this.title.assemble();
    this.busy = false;
    this.hintEl.textContent = this.touch ? "Tap to start" : "Click to start";
    this.hintEl.classList.remove("off");
    this.nameEl.classList.add("ready");
  }

  /* ---------- Events ---------- */

  private bindGlobalEvents(): void {
    addEventListener("resize", () => this.resize());
    this.nameEl.addEventListener("click", () => this.openMenu());
    this.nameEl.addEventListener("pointerenter", e => {
      if (e.pointerType === "mouse" && !this.busy && !this.game) this.title.flip();
    });
    addEventListener("pointermove", e => {
      if (this.settings.trail && !this.game && !this.reduce) this.trail.warm(e.clientX, e.clientY);
    });
    // Any first tap or key unlocks sound (browsers require a user gesture).
    const unlock = () => {
      this.audio.unlock();
      this.music.unlock();
    };
    // iPhones may only allow audio when a tap ends, so listen to the whole tap.
    for (const ev of ["pointerdown", "touchend", "click", "keydown"]) addEventListener(ev, unlock, { capture: true });
    // iPhones can close background tabs without warning: save when leaving.
    addEventListener("pagehide", () => this.game?.pause());
    addEventListener("pointerdown", e => {
      if (this.intro.playing) {
        this.intro.skip();
        return;
      }
      if (this.settings.trail && !this.game && !this.reduce) this.trail.warm(e.clientX, e.clientY);
    });
    addEventListener("keydown", e => this.onKey(e));
    // Pause and go quiet when the tab or app is hidden.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.game?.pause();
        this.music.setPlaying(false);
      } else {
        this.music.setPlaying(true);
      }
    });
  }

  private onKey(e: KeyboardEvent): void {
    if ((e.target as HTMLElement).closest?.("input")) return; // typing a world name or seed
    const inGame = !!this.game;
    if (inGame && this.pauseEl.hidden) return; // the game handles its own keys
    if (!this.menuOpen && !inGame) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.openMenu();
      }
      return;
    }
    const menu = inGame ? this.pauseMenu : this.titleMenu;
    if (menu.handleKey(e)) {
      e.preventDefault();
      return;
    }
    if (e.key === "Escape") {
      if (this.stack.length > 1) this.back();
      else if (inGame) this.resumeGame();
    }
  }

  private resize(): void {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.particles.resize(dpr);
    this.trail.resize(dpr, this.title.pixelSize);
  }

  /* ---------- Menus ---------- */

  private screens(): Record<Screen, () => MenuItem[]> {
    const s = this.settings;
    const onOff = (v: boolean) => (v ? "On" : "Off");
    const toggle = (k: keyof Settings) => () => {
      (s[k] as boolean) = !s[k];
      this.saveSettings();
    };
    const look = (d: number) => {
      s.look = ((s.look - 1 + d + 10) % 10) + 1;
      this.saveSettings();
    };
    const sfx = (d: number) => {
      s.sfxVolume = Math.max(0, Math.min(10, s.sfxVolume + d));
      this.saveSettings();
      this.audio.click();
    };
    const amb = (d: number) => {
      s.ambienceVolume = Math.max(0, Math.min(10, s.ambienceVolume + d));
      this.saveSettings();
    };
    const volume = (d: number) => {
      s.musicVolume = Math.max(0, Math.min(10, s.musicVolume + d));
      this.saveSettings();
    };
    return {
      main: () => [
        button("Play", () => this.go("worlds")),
        button("How to play", () => this.go("howto")),
        button("Settings", () => this.go("settings")),
        button("Credits", () => this.go("credits")),
        // iPhones only allow true fullscreen for sites added to the Home Screen.
        ...(this.showInstallTip ? [button("Play fullscreen", () => this.go("install"), { detail: "Add to Home Screen" })] : []),
      ],
      install: () => [
        title("Fullscreen"),
        text("1. Tap the Share button<br>2. Choose Add to Home Screen<br>3. Open Gracia from there"),
        text("It opens fullscreen like an app,<br>with your worlds kept."),
        button("Got it", () => {
          writeJSON(`${GAME.storagePrefix}.installTipDone`, true);
          this.stack = ["main"];
          this.render();
        }),
        button("Back", () => this.back()),
      ],
      worlds: () => {
        const worlds = listWorlds();
        return [
          title("Worlds"),
          button("Create new world", () => this.newWorld()),
          ...worlds.map(w =>
            button(w.name, () => {
              this.selected = w;
              this.go("world");
            }, { detail: `${getMap(w.mapId).name} · ${MODE_NAMES[w.mode]} · ${ago(w.lastPlayed)}` }),
          ),
          ...(worlds.length ? [] : [text("No saved worlds yet")]),
          button("Back", () => this.back()),
        ];
      },
      world: () => {
        const w = this.selected;
        if (!w) return [button("Back", () => this.back())];
        return [
          title(w.name),
          text(`${escapeHtml(getMap(w.mapId).name)} · ${MODE_NAMES[w.mode]}<br>Seed ${w.seed}`),
          button("Play", () => void this.play(w)),
          button("Delete world", () => this.go("confirm-delete")),
          button("Back", () => this.back()),
        ];
      },
      "confirm-delete": () => [
        title("Delete world?"),
        text(`"${escapeHtml(this.selected?.name ?? "")}" and everything<br>built in it will be gone for good.`),
        button("Yes, delete it", () => {
          if (this.selected) deleteWorld(this.selected.id);
          this.selected = null;
          this.stack = ["main", "worlds"];
          this.render();
        }),
        button("No", () => this.back()),
      ],
      create: () => {
        const d = this.draft;
        const map = MAPS[d.map];
        const cycleMap = (dir: number) => {
          d.map = (d.map + dir + MAPS.length) % MAPS.length;
          this.render(false, this.menu.focusedIndex());
        };
        return [
          title("New world"),
          input("Name", d.name, v => (d.name = v), { placeholder: "New world" }),
          button(`Map: ${map.name}`, () => cycleMap(1), { detail: map.description, onAdjust: cycleMap }),
          button(`Mode: ${MODE_NAMES[d.mode]}`, () => {
            d.mode = d.mode === "survival" ? "creative" : "survival";
            this.render(false, this.menu.focusedIndex());
          }, { detail: d.mode === "survival" ? "Health, hunger · gather and craft" : "Every block · fly · can't get hurt" }),
          input("Seed", d.seed, v => (d.seed = v), { placeholder: "Random", maxLength: 24 }),
          button("Create world", () => {
            const w = createWorld({ name: d.name, mapId: map.id, mode: d.mode, seed: seedFromText(d.seed) });
            void this.play(w);
          }),
          button("Back", () => this.back()),
        ];
      },
      settings: () => [
        title("Settings"),
        button("Music", () => this.go("music")),
        button(`Sound effects: ${s.sfxVolume || "Off"}`, () => sfx(s.sfxVolume >= 10 ? -10 : 1), { onAdjust: sfx }),
        button(`Ambience: ${s.ambienceVolume || "Off"}`, () => amb(s.ambienceVolume >= 10 ? -10 : 1), { onAdjust: amb }),
        button(`Camera: ${s.camera === "first" ? "1st" : "3rd"} person`, () => {
          s.camera = s.camera === "first" ? "third" : "first";
          this.saveSettings();
        }),
        button(`Look speed: ${s.look}`, () => look(1), { onAdjust: look }),
        button(`Invert look: ${onOff(s.invertY)}`, toggle("invertY")),
        button(`Retro pixels: ${onOff(s.retro)}`, toggle("retro")),
        button(`Day and night: ${onOff(s.dayCycle)}`, toggle("dayCycle")),
        button(`Intro movie: ${onOff(s.intro)}`, toggle("intro")),
        button(`Cursor trail: ${onOff(s.trail)}`, toggle("trail")),
        button(`Show FPS: ${onOff(s.showFps)}`, toggle("showFps")),
        button("Back", () => this.back()),
      ],
      music: () => {
        const { game, device } = this.music.count;
        const current = this.music.current;
        const items: MenuItem[] = [
          title("Music"),
          button(`Music: ${onOff(s.music)}`, toggle("music")),
          button(`Volume: ${s.musicVolume}`, () => volume(s.musicVolume >= 10 ? -10 : 1), { onAdjust: volume }),
        ];
        if (game + device === 0) {
          items.push(text("No songs yet.<br>Add some from your device."));
        } else {
          items.push(text(s.music && current ? `Now playing<br>${escapeHtml(current.title)}` : `${game + device} songs`));
          items.push(button("Next song", () => this.music.next()));
        }
        items.push(button("Add songs from device", () => this.songPicker.click(), { detail: "Stays on this device only" }));
        if (device) {
          items.push(button(`Remove my songs (${device})`, async () => {
            await clearDeviceSongs();
            await this.music.load();
          }));
        }
        items.push(button("Back", () => this.back()));
        return items;
      },
      howto: () => [
        title("How to play"),
        text(
          this.touch
            ? "Left thumb: move · push up to sprint<br>Right side: drag to look<br>Hold MINE · tap USE to build or eat<br>BAG: inventory and crafting<br>CMD: commands like /give"
            : "WASD move · Mouse look<br>Space jump · Shift sprint<br>Hold left click: mine<br>Right click: build or eat<br>E: inventory and crafting<br>T or /: commands · Q: drop<br>1-9 blocks · V camera",
        ),
        button("Back", () => this.back()),
      ],
      credits: () => [title("Credits"), text(GAME.credits.join("<br>")), button("Back", () => this.back())],
      pause: () => [
        title("Paused"),
        button("Resume", () => this.resumeGame()),
        button("Settings", () => this.go("settings")),
        button("How to play", () => this.go("howto")),
        button("Save and quit", () => this.toMainMenu()),
      ],
    };
  }

  private get showInstallTip(): boolean {
    return isIOS() && !isStandalone() && !readJSON(`${GAME.storagePrefix}.installTipDone`, false);
  }

  private get menu(): Menu {
    return this.game ? this.pauseMenu : this.titleMenu;
  }

  private render(animate = true, focus = -1): void {
    const screen = this.stack[this.stack.length - 1];
    this.menu.render(this.screens()[screen](), { animate: animate && !this.reduce, focus });
  }

  private go(screen: Screen): void {
    this.stack.push(screen);
    this.render();
  }

  private back(): void {
    if (this.stack.length > 1) this.stack.pop();
    this.render();
  }

  private saveSettings(): void {
    saveSettings(this.settings);
    this.applyAudioSettings();
    this.game?.setSettings(this.settings);
    // Redraw in place so the changed label shows, keeping keyboard focus.
    const at = this.menu.focusedIndex();
    this.render(false, at);
  }

  private applyAudioSettings(): void {
    this.audio.setVolumes(this.settings.sfxVolume / 10, this.settings.ambienceVolume / 10);
    this.music.enabled = this.settings.music;
    this.music.setVolume(this.settings.musicVolume / 10);
    this.music.setPlaying(true);
  }

  /** Save songs picked from the device, then add them to the playlist. */
  private async addSongs(): Promise<void> {
    const files = this.songPicker.files;
    if (!files?.length) return;
    const added = await addDeviceSongs(files);
    this.songPicker.value = "";
    await this.music.load();
    if (added && !this.settings.music) {
      this.settings.music = true;
      this.saveSettings();
    }
  }

  private openMenu(): void {
    if (this.menuOpen || this.busy) return;
    this.menuOpen = true;
    this.audio.click();
    // Slide the name up into place as the options appear below it.
    const before = this.nameEl.getBoundingClientRect().top;
    this.hintEl.hidden = true;
    this.menuEl.hidden = false;
    this.menuEl.parentElement?.classList.add("menu-open");
    this.stack = ["main"];
    this.render();
    const shift = before - this.nameEl.getBoundingClientRect().top;
    if (!this.reduce && shift) {
      this.nameEl.animate([{ transform: `translateY(${shift}px)` }, { transform: "none" }], { duration: 320, easing: "steps(6)" });
    }
    void import("../game/Game"); // start loading the game in the background
  }

  /* ---------- Playing ---------- */

  private newWorld(): void {
    const n = listWorlds().length + 1;
    const map = this.draft.map;
    this.draft = { name: `World ${n}`, map, mode: MAPS[map].defaultMode ?? "survival", seed: "" };
    this.go("create");
  }

  private async play(world: WorldMeta): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    // Ask for fullscreen landscape now, while we still have the tap.
    Viewport.requestLandscape();
    this.menuEl.hidden = true;
    const loading = import("../game/Game");
    const r = this.nameEl.getBoundingClientRect();
    await this.title.mine(r.left + r.width / 2, r.top + r.height / 2);
    if (this.settings.intro && !this.reduce) await this.intro.play();
    try {
      const { Game } = await loading;
      this.startGame(Game, world);
    } catch {
      this.busy = false;
      this.menuEl.hidden = false;
      this.stack = ["main"];
      this.render();
      this.menuEl.insertAdjacentHTML("afterbegin", '<p class="menu-text">Could not load the game.<br>Please try again.</p>');
      await this.title.rebuild();
    }
  }

  private startGame(GameClass: typeof Game, world: WorldMeta): void {
    this.playLayer.hidden = false;
    this.viewport.setActive(true);
    this.game = new GameClass({
      container: this.gameEl,
      viewport: this.viewport,
      settings: this.settings,
      world,
      audio: this.audio,
      onPause: () => this.showPause(),
      onExitToMenu: () => void this.toMainMenu(),
    });
    this.busy = false;
    this.game.resume();
  }

  private showPause(): void {
    this.stack = ["pause"];
    this.pauseEl.hidden = false;
    this.render();
  }

  private resumeGame(): void {
    this.pauseEl.hidden = true;
    this.stack = ["pause"];
    this.game?.resume();
  }

  private async toMainMenu(): Promise<void> {
    this.game?.dispose();
    this.game = null;
    this.pauseEl.hidden = true;
    this.playLayer.hidden = true;
    this.viewport.setActive(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    this.busy = true;
    this.stack = ["main"];
    this.menuEl.hidden = false;
    this.render();
    await this.title.rebuild();
    this.busy = false;
  }
}
