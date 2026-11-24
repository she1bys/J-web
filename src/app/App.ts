import { GAME } from "../config/game";
import { loadSettings, saveSettings, type Settings } from "../config/settings";
import { Sfx } from "../core/audio";
import { Music } from "../core/music";
import { isTouchDevice, prefersReducedMotion } from "../core/timeline";
import { Viewport } from "../core/viewport";
import { textToRows } from "../fonts/pixelFont";
import { SunsetIntro } from "../cinematic/SunsetIntro";
import { Particles } from "../title/Particles";
import { PixelTrail } from "../title/PixelTrail";
import { TitleScreen } from "../title/TitleScreen";
import { Menu, button, text, title, type MenuItem } from "../ui/Menu";
import { MAPS, getMap, type MapDefinition } from "../game/maps";
import { loadMapSave, clearMapSave } from "../game/world/WorldStore";
import type { Game } from "../game/Game";

type Screen = "main" | "maps" | "settings" | "howto" | "credits" | "pause" | "confirm-reset";

/**
 * The whole app as a small state machine:
 * title → menu → (map select) → break the name → intro movie → game ⇄ pause menu.
 */
export class App {
  private settings: Settings = loadSettings();
  private readonly sfx = new Sfx();
  private readonly music = new Music();
  private readonly touch = isTouchDevice();
  private readonly reduce = prefersReducedMotion();
  private readonly titleRows = textToRows(GAME.title);

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
  private currentMap: MapDefinition | null = null;

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
    const click = () => this.sfx.click();
    this.titleMenu = new Menu(this.menuEl, click);
    this.pauseMenu = new Menu(this.pauseEl.querySelector(".menu")!, click);

    this.applyAudioSettings();
    this.sfx.onReady = (ctx, out) => {
      this.music.attach(ctx, out);
      this.music.setPlaying(true);
    };
    this.bindGlobalEvents();
    void this.start();
  }

  private async start(): Promise<void> {
    this.title.build(GAME.title);
    this.resize();
    await this.title.assemble();
    this.busy = false;
    this.hintEl.textContent = this.touch ? "Tap her name" : "Click her name";
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
    const unlock = () => this.sfx.unlock();
    addEventListener("pointerdown", unlock, { capture: true });
    addEventListener("keydown", unlock, { capture: true });
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
    return {
      main: () => [
        button("Play", () => this.go("maps")),
        button("How to play", () => this.go("howto")),
        button("Settings", () => this.go("settings")),
        button("Credits", () => this.go("credits")),
      ],
      maps: () => [
        title("Choose a map"),
        ...MAPS.map(m => {
          const found = loadMapSave(m.id)?.letters.length ?? 0;
          const letters = `${found}/${GAME.collectWord.length} letters`;
          return button(m.name, () => this.play(m), { detail: `${m.description} · ${letters}` });
        }),
        button("Back", () => this.back()),
      ],
      settings: () => [
        title("Settings"),
        button(`Sound: ${onOff(s.sound)}`, toggle("sound")),
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
      howto: () => [
        title("How to play"),
        text(
          this.touch
            ? "Left thumb: move · push up to sprint<br>Right side: drag to look<br>Hold MINE · tap BUILD · JUMP<br>Find the 5 pink letters!"
            : "WASD move · Mouse look<br>Space jump · Shift sprint<br>Hold left click: mine<br>Right click: build<br>1-9 blocks · V camera<br>Find the 5 pink letters!",
        ),
        button("Back", () => this.back()),
      ],
      credits: () => [title("Credits"), text(GAME.credits.join("<br>")), button("Back", () => this.back())],
      pause: () => [
        title("Paused"),
        button("Resume", () => this.resumeGame()),
        button("Settings", () => this.go("settings")),
        button("How to play", () => this.go("howto")),
        button("Restart map", () => this.go("confirm-reset")),
        button("Main menu", () => this.toMainMenu()),
      ],
      "confirm-reset": () => [
        title("Restart map?"),
        text("Your building and letters<br>on this map will be erased."),
        button("Yes, restart", () => this.resetMap()),
        button("No", () => this.back()),
      ],
    };
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
    this.sfx.enabled = this.settings.sound;
    this.music.enabled = this.settings.sound;
    this.music.setPlaying(true);
  }

  private openMenu(): void {
    if (this.menuOpen || this.busy) return;
    this.menuOpen = true;
    this.sfx.click();
    // Slide the name up into place as the options appear below it.
    const before = this.nameEl.getBoundingClientRect().top;
    this.hintEl.hidden = true;
    this.menuEl.hidden = false;
    this.stack = ["main"];
    this.render();
    const shift = before - this.nameEl.getBoundingClientRect().top;
    if (!this.reduce && shift) {
      this.nameEl.animate([{ transform: `translateY(${shift}px)` }, { transform: "none" }], { duration: 320, easing: "steps(6)" });
    }
    void import("../game/Game"); // start loading the game in the background
  }

  /* ---------- Playing ---------- */

  private async play(map: MapDefinition): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    // Ask for fullscreen landscape now, while we still have the tap.
    Viewport.requestLandscape();
    this.menuEl.hidden = true;
    const loading = import("../game/Game");
    const r = this.nameEl.getBoundingClientRect();
    await this.title.mine(r.left + r.width / 2, r.top + r.height / 2);
    if (this.settings.intro && !this.reduce) await this.intro.play(this.titleRows);
    try {
      const { Game } = await loading;
      this.startGame(Game, map);
    } catch {
      this.busy = false;
      this.menuEl.hidden = false;
      this.stack = ["main"];
      this.render();
      this.menuEl.insertAdjacentHTML("afterbegin", '<p class="menu-text">Could not load the game.<br>Please try again.</p>');
      await this.title.rebuild();
    }
  }

  private startGame(GameClass: typeof Game, map: MapDefinition): void {
    this.currentMap = map;
    this.playLayer.hidden = false;
    this.viewport.setActive(true);
    this.game = new GameClass({
      container: this.gameEl,
      viewport: this.viewport,
      settings: this.settings,
      map,
      sfx: this.sfx,
      titleRows: this.titleRows,
      word: GAME.collectWord,
      onPause: () => this.showPause(),
      onAllLettersFound: () => void this.celebrate(),
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

  private async resetMap(): Promise<void> {
    const map = this.currentMap ?? getMap("meadow");
    clearMapSave(map.id);
    this.game?.dispose();
    this.game = null;
    this.pauseEl.hidden = true;
    const { Game } = await import("../game/Game");
    this.startGame(Game, map);
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

  /** All letters found: play the sunset movie as an ending, then carry on playing. */
  private async celebrate(): Promise<void> {
    if (!this.game) return;
    this.game.pause(false);
    this.sfx.fanfare();
    await this.intro.play(this.titleRows);
    this.game.resume();
    this.game.toast(`You found ${GAME.collectWord}!`);
  }
}
