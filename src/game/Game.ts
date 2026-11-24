import * as THREE from "three";
import type { Settings, CameraMode } from "../config/settings";
import type { Sfx } from "../core/audio";
import { createRng } from "../core/random";
import type { Viewport } from "../core/viewport";
import { isTouchDevice } from "../core/timeline";
import type { MapDefinition, Vec3 } from "./maps/types";
import { World } from "./world/World";
import { Block, blockDef } from "./world/blocks";
import { ChunkRenderer } from "./world/ChunkRenderer";
import { raycast, type RayHit } from "./world/raycast";
import { loadMapSave, saveMapSave } from "./world/WorldStore";
import { paintAtlas, tileAverage } from "./textures/atlas";
import { Player } from "./player/Player";
import { CameraRig } from "./player/CameraRig";
import { Character } from "./player/Character";
import { Sky } from "./effects/Sky";
import { Clouds } from "./effects/Clouds";
import { Debris } from "./effects/Debris";
import { BlockSelection } from "./effects/BlockSelection";
import { Letters } from "./collectibles/Letters";
import { Hud } from "./hud/Hud";
import { emptyInput, type InputActions } from "./input/InputState";
import { KeyboardMouse } from "./input/KeyboardMouse";
import { TouchControls } from "./input/TouchControls";

/** One in-game day, in seconds. */
const DAY_SECONDS = 600;
const REACH = 5;

export interface GameOptions {
  /** The element the game draws into (the play layer). */
  container: HTMLElement;
  viewport: Viewport;
  settings: Settings;
  map: MapDefinition;
  sfx: Sfx;
  /** Bitmap of the title, for signs in the world. */
  titleRows: string[];
  /** The word whose letters are hidden in the map. */
  word: string;
  /** The player asked to pause (button, Esc, or the mouse was released). */
  onPause: () => void;
  onAllLettersFound: () => void;
}

/**
 * A playable map: owns the world, rendering, player, controls and HUD,
 * and runs the frame loop while not paused.
 */
export class Game {
  private readonly opts: GameOptions;
  private readonly map: MapDefinition;
  private readonly touch = isTouchDevice();
  private settings: Settings;
  private camMode: CameraMode;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(75, 1, 0.05, 260);
  private canvas: HTMLCanvasElement;
  private texture: THREE.CanvasTexture;
  private atlas: HTMLCanvasElement;

  private world: World;
  private chunks: ChunkRenderer;
  private player: Player;
  private rig: CameraRig;
  private character = new Character();
  private sky: Sky;
  private clouds: Clouds;
  private debris: Debris;
  private selection: BlockSelection;
  private letters: Letters;
  private hud: Hud;
  private input = emptyInput();
  private kbm: KeyboardMouse | null = null;
  private touchControls: TouchControls | null = null;

  private spawn: Vec3 & { yaw: number };
  private letterSpots: Vec3[];
  private found: Set<number>;
  private time: number;
  private slot = 0;
  private target: RayHit | null = null;
  private mineKey = "";
  private mineProgress = 0;
  private mineCooldown = 0;
  private hitTimer = 0;
  private saveTimer = 0;
  private dirty = false;
  private paused = true;
  private disposed = false;
  private lastT = 0;
  private colors = new Map<number, [number, number, number]>();
  private unsubscribeViewport: () => void;

  constructor(opts: GameOptions) {
    this.opts = opts;
    this.map = opts.map;
    this.settings = { ...opts.settings };
    this.camMode = this.settings.camera;

    // World: generate the map, then re-apply anything the player changed last time.
    const { size } = this.map;
    this.world = new World(size.x, size.y, size.z);
    const layout = this.map.generate(this.world, {
      rng: createRng(this.map.seed),
      titleRows: opts.titleRows,
      letterCount: opts.word.length,
    });
    this.spawn = layout.spawn;
    this.letterSpots = layout.letterSpots;
    const save = loadMapSave(this.map.id);
    if (save) this.world.applyEdits(save.edits);
    this.world.recording = true;
    this.found = new Set(save?.letters ?? []);
    this.time = save?.time ?? this.map.startTime;

    // Rendering
    this.canvas = document.createElement("canvas");
    this.canvas.className = "g-view";
    opts.container.appendChild(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: "high-performance" });
    this.atlas = paintAtlas();
    this.texture = new THREE.CanvasTexture(this.atlas);
    this.texture.magFilter = this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;

    this.chunks = new ChunkRenderer(this.world, this.texture, this.scene);
    this.chunks.buildAll();
    this.sky = new Sky(this.scene, this.map.sky, this.map.fog);
    this.clouds = new Clouds(this.scene, size.x, size.z, size.y + 2, this.map.seed);
    this.debris = new Debris(this.scene, this.world);
    this.selection = new BlockSelection(this.scene, this.texture);
    this.letters = new Letters(this.scene, opts.word, this.letterSpots, this.found);

    // Player
    this.player = new Player(this.world);
    const sp = save?.player;
    this.player.pos.set(sp?.x ?? this.spawn.x, sp?.y ?? this.spawn.y, sp?.z ?? this.spawn.z);
    this.player.yaw = sp?.yaw ?? this.spawn.yaw;
    this.player.pitch = sp?.pitch ?? 0.12;
    if (this.player.collides()) this.respawn();
    this.rig = new CameraRig(this.camera, this.world);
    this.scene.add(this.character.root);

    // Controls and HUD
    const actions: InputActions = {
      place: () => this.place(),
      toggleCamera: () => { this.camMode = this.camMode === "first" ? "third" : "first"; },
      toggleFly: () => this.toggleFly(),
      selectSlot: n => this.select(n),
      cycleSlot: d => this.select(this.slot + d),
      pause: () => this.pause(),
    };
    this.hud = new Hud(opts.container, this.atlas, this.map.hotbar, opts.word, this.touch, () => this.pause(), n => this.select(n));
    if (this.touch) {
      this.touchControls = new TouchControls(opts.container, this.canvas, this.input, actions, opts.viewport, !!this.map.allowFlight);
    } else {
      this.kbm = new KeyboardMouse(this.canvas, this.input, actions, locked => {
        this.hud.showHint(!locked && !this.paused);
        if (!locked && !this.paused) this.pause();
      });
    }
    this.hud.setLetters(this.found);
    this.hud.setFpsVisible(this.settings.showFps);
    this.select(0);

    this.unsubscribeViewport = opts.viewport.onChange(this.resize);
    addEventListener("resize", this.resize);
    this.resize();
  }

  /* ---------- Lifecycle ---------- */

  resume(): void {
    if (!this.paused || this.disposed) return;
    this.paused = false;
    if (this.kbm) {
      this.kbm.enabled = true;
      this.hud.showHint(true);
      this.kbm.requestLock();
    }
    if (this.touchControls) {
      this.touchControls.enabled = true;
      this.hud.showHint(true);
      setTimeout(() => this.hud.showHint(false), 4500);
    }
    this.lastT = performance.now();
    requestAnimationFrame(this.frame);
  }

  /** Stop the loop. `notify` false is used for cutscenes (no pause menu). */
  pause(notify = true): void {
    if (this.paused) return;
    this.paused = true;
    if (this.kbm) {
      this.kbm.enabled = false;
      this.kbm.reset();
      this.kbm.releaseLock();
    }
    if (this.touchControls) {
      this.touchControls.enabled = false;
      this.touchControls.reset();
    }
    this.hud.showHint(false);
    this.save();
    if (notify) this.opts.onPause();
  }

  setSettings(s: Settings): void {
    const cameraChanged = s.camera !== this.settings.camera;
    this.settings = { ...s };
    if (cameraChanged) this.camMode = s.camera;
    this.hud.setFpsVisible(s.showFps);
    if (!s.dayCycle) this.time = this.map.startTime;
    this.resize();
  }

  toast(text: string): void {
    this.hud.toast(text, 3200);
  }

  dispose(): void {
    if (this.disposed) return;
    this.pause(false);
    this.disposed = true;
    removeEventListener("resize", this.resize);
    this.unsubscribeViewport();
    this.kbm?.dispose();
    this.touchControls?.dispose();
    this.hud.dispose();
    this.chunks.dispose();
    this.sky.dispose();
    this.clouds.dispose();
    this.debris.dispose();
    this.selection.dispose();
    this.letters.dispose();
    this.character.dispose();
    this.texture.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }

  /* ---------- Frame loop ---------- */

  private frame = (now: number): void => {
    if (this.paused || this.disposed) return;
    requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number): void {
    const { player, input, settings } = this;

    // Look
    const sens = (0.0008 + settings.look * 0.00045) * (this.touch ? 2.4 : 1);
    player.yaw -= input.lookX * sens;
    player.pitch -= input.lookY * sens * (settings.invertY ? -1 : 1);
    player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch));
    input.lookX = input.lookY = 0;

    // Move
    const ev = player.update(dt, {
      x: input.moveX, z: input.moveZ, jump: input.jump, sprint: input.sprint, descend: input.descend,
    }, this.touch);
    const sfx = this.opts.sfx;
    if (ev.step !== null) {
      const d = blockDef(ev.step);
      if (d) sfx.step(d.sound);
    }
    if (ev.landed) {
      const d = blockDef(this.world.get(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.1), Math.floor(player.pos.z)));
      if (d) sfx.place(d.sound);
    }
    if (ev.splashed) sfx.splash();
    if (player.pos.y < -10) this.respawn();

    // Camera and character
    this.rig.update(player, this.camMode, dt);
    this.character.root.visible = this.camMode === "third";
    this.character.root.position.copy(player.pos);
    this.character.root.rotation.y = player.yaw;
    this.character.animate(dt, player.speed, player.inWater || player.flying);

    // Sky and lighting
    if (settings.dayCycle) this.time = (this.time + dt / DAY_SECONDS) % 1;
    this.sky.update(this.time, this.camera, this.rig.underwater());
    this.chunks.setLight(this.sky.light);
    this.clouds.update(dt, this.sky.light);
    this.debris.update(dt, this.sky.light);

    this.updateTarget();
    this.updateMining(dt);

    // Hidden letters
    const got = this.letters.update(dt, player.pos);
    if (got >= 0) this.collect(got);

    this.hud.tickFps(dt);
    this.saveTimer += dt;
    if (this.dirty && this.saveTimer > 8) this.save();
  }

  /* ---------- Blocks ---------- */

  private updateTarget(): void {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const extra = this.camMode === "third" ? this.camera.position.distanceTo(this.player.eye) : 0;
    this.target = raycast(this.world, this.camera.position, dir, REACH + extra);
    if (!this.target) this.selection.hide();
  }

  private updateMining(dt: number): void {
    this.mineCooldown -= dt;
    const t = this.target;
    if (!t) {
      this.mineProgress = 0;
      return;
    }
    if (!this.input.mining || this.mineCooldown > 0) {
      this.mineProgress = 0;
      this.mineKey = "";
      this.selection.show(t.x, t.y, t.z, 0);
      return;
    }
    const key = `${t.x},${t.y},${t.z}`;
    if (key !== this.mineKey) {
      this.mineKey = key;
      this.mineProgress = 0;
      this.hitTimer = 0;
    }
    const def = blockDef(this.world.get(t.x, t.y, t.z));
    if (!def) return;
    const creative = !!this.map.allowFlight;
    this.mineProgress += creative || def.hardness <= 0 ? 1 : dt / def.hardness;
    this.hitTimer -= dt;
    if (this.hitTimer <= 0 && !creative) {
      this.opts.sfx.hit(def.sound);
      this.hitTimer = 0.22;
    }
    this.selection.show(t.x, t.y, t.z, this.mineProgress);
    if (this.mineProgress >= 1) {
      this.breakBlock(t);
      this.mineProgress = 0;
      this.mineKey = "";
      this.mineCooldown = creative ? 0.2 : 0.05;
    }
  }

  private colorOf(id: number): [number, number, number] {
    let c = this.colors.get(id);
    if (!c) {
      c = tileAverage(this.atlas, blockDef(id)?.tiles[1] ?? 0);
      this.colors.set(id, c);
    }
    return c;
  }

  private breakBlock(t: RayHit): void {
    const id = this.world.get(t.x, t.y, t.z);
    const def = blockDef(id);
    // Water next to the hole flows into it.
    const w = this.world;
    const wet = w.isWater(t.x, t.y + 1, t.z) || w.isWater(t.x + 1, t.y, t.z) || w.isWater(t.x - 1, t.y, t.z) ||
      w.isWater(t.x, t.y, t.z + 1) || w.isWater(t.x, t.y, t.z - 1);
    w.set(t.x, t.y, t.z, wet ? Block.Water : Block.Air);
    this.chunks.markDirty(t.x, t.z);
    this.chunks.flush();
    this.debris.burst(t.x, t.y, t.z, this.colorOf(id));
    if (def) this.opts.sfx.breakBlock(def.sound);
    navigator.vibrate?.(12);
    this.dirty = true;
  }

  private place(): void {
    const t = this.target;
    if (!t || this.paused) return;
    const { px, py, pz } = t;
    const w = this.world;
    if (!w.inBounds(px, py, pz)) return;
    const here = w.get(px, py, pz);
    if (here !== Block.Air && here !== Block.Water) return;
    if (this.player.overlapsBlock(px, py, pz)) return;
    const id = this.map.hotbar[this.slot];
    w.set(px, py, pz, id);
    this.chunks.markDirty(px, pz);
    this.chunks.flush();
    const def = blockDef(id);
    if (def) this.opts.sfx.place(def.sound);
    navigator.vibrate?.(8);
    this.dirty = true;
  }

  private select(n: number): void {
    const len = this.map.hotbar.length;
    this.slot = ((n % len) + len) % len;
    this.hud.select(this.slot, blockDef(this.map.hotbar[this.slot])?.name ?? "");
  }

  private toggleFly(): void {
    if (!this.map.allowFlight) return;
    this.player.flying = !this.player.flying;
    this.player.vel.y = 0;
    this.hud.setFlying(this.player.flying);
    this.touchControls?.setFlying(this.player.flying);
  }

  /* ---------- Letters ---------- */

  private collect(index: number): void {
    this.found.add(index);
    this.hud.setLetters(this.found);
    this.opts.sfx.collect();
    navigator.vibrate?.([20, 40, 20]);
    const word = this.opts.word;
    this.hud.toast(`Found "${word[index]}"  ${this.found.size}/${word.length}`);
    this.dirty = true;
    this.save();
    if (this.found.size >= word.length) setTimeout(() => this.opts.onAllLettersFound(), 900);
  }

  /* ---------- Saving ---------- */

  private save(): void {
    const flat: number[] = [];
    for (const [i, id] of this.world.edits) flat.push(i, id);
    const p = this.player;
    saveMapSave(this.map.id, {
      v: 1,
      edits: flat,
      player: { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, pitch: p.pitch },
      letters: [...this.found],
      time: this.time,
    });
    this.dirty = false;
    this.saveTimer = 0;
  }

  private respawn(): void {
    const s = this.spawn;
    this.player.pos.set(s.x, s.y, s.z);
    // If something was built on the spawn point, start on top of it.
    while (this.player.collides() && this.player.pos.y < this.world.sy) this.player.pos.y += 1;
    this.player.vel.set(0, 0, 0);
  }

  /* ---------- Sizing ---------- */

  private resize = (): void => {
    const w = this.opts.viewport.width;
    const h = this.opts.viewport.height;
    const dpr = devicePixelRatio || 1;
    // Retro mode renders at low resolution and scales up with hard pixel edges.
    const ratio = this.settings.retro
      ? Math.min(1, Math.max(320, w / 2) / w)
      : Math.min(dpr, this.touch ? 1.5 : 2);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };
}
