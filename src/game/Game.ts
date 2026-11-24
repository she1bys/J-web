import * as THREE from "three";
import type { Settings, CameraMode } from "../config/settings";
import type { AudioEngine } from "../audio/AudioEngine";
import { Ambience } from "../audio/Ambience";
import { createRng, type Rng } from "../core/random";
import type { Viewport } from "../core/viewport";
import { isTouchDevice } from "../core/timeline";
import { AdaptiveQuality } from "../core/quality";
import { getMap, type MapDefinition, type Vec3 } from "./maps";
import { MODE_NAMES, MODE_RULES, type GameMode, type ModeRules } from "./modes";
import { World } from "./world/World";
import { Block, blockDef } from "./world/blocks";
import { ChunkRenderer } from "./world/ChunkRenderer";
import { raycast, type RayHit } from "./world/raycast";
import {
  DEFAULT_RULES, loadWorld, saveWorld, updateWorldMeta,
  type WorldMeta, type WorldRules,
} from "./world/WorldStore";
import { paintAtlas, tileAverage } from "./textures/atlas";
import { Player } from "./player/Player";
import { CameraRig } from "./player/CameraRig";
import { Character } from "./player/Character";
import { HeldItem } from "./player/HeldItem";
import { Sky } from "./effects/Sky";
import { Clouds } from "./effects/Clouds";
import { Debris } from "./effects/Debris";
import { BlockSelection } from "./effects/BlockSelection";
import { ItemEntities } from "./entities/ItemEntities";
import { Inventory, type ItemStack } from "./items/Inventory";
import { itemDef } from "./items/items";
import { blockDrops, miningInfo } from "./items/drops";
import { Vitals } from "./survival/Vitals";
import { createCommands } from "./commands/builtin";
import type { CommandContext } from "./commands/types";
import type { CommandRegistry } from "./commands/registry";
import { Hud } from "./hud/Hud";
import { InventoryScreen } from "./hud/InventoryScreen";
import { CommandBar } from "./hud/CommandBar";
import { DeathScreen } from "./hud/DeathScreen";
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
  /** The saved world to play. */
  world: WorldMeta;
  audio: AudioEngine;
  /** The player asked to pause (button, Esc, or the mouse was released). */
  onPause: () => void;
  /** "Main menu" from the death screen. */
  onExitToMenu: () => void;
}

/**
 * A playable world: owns the blocks, rendering, player, inventory, survival stats,
 * dropped items, commands, controls and HUD, and runs the frame loop while not paused.
 */
export class Game {
  private readonly opts: GameOptions;
  private readonly meta: WorldMeta;
  private readonly map: MapDefinition;
  private readonly touch = isTouchDevice();
  private readonly rng: Rng;
  private settings: Settings;
  private camMode: CameraMode;
  private mode: GameMode;
  private rules: WorldRules;

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
  private held: HeldItem;
  private sky: Sky;
  private clouds: Clouds;
  private debris: Debris;
  private selection: BlockSelection;
  private items: ItemEntities;

  private inventory = new Inventory();
  private vitals = new Vitals();
  private commands: CommandRegistry = createCommands();

  private hud: Hud;
  private invScreen: InventoryScreen;
  private cmdBar: CommandBar;
  private death: DeathScreen;
  private input = emptyInput();
  private kbm: KeyboardMouse | null = null;
  private touchControls: TouchControls | null = null;

  private spawn: Vec3 & { yaw: number };
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
  private quality = new AdaptiveQuality();
  private ambience: Ambience;
  private unsubscribers: (() => void)[] = [];

  constructor(opts: GameOptions) {
    this.opts = opts;
    this.meta = opts.world;
    this.map = getMap(this.meta.mapId);
    this.settings = { ...opts.settings };
    this.camMode = this.settings.camera;
    this.rng = createRng(this.meta.seed ^ 0x5bd1e995);

    // World: generate from the seed, then re-apply everything the player changed.
    const { size } = this.map;
    this.world = new World(size.x, size.y, size.z);
    const layout = this.map.generate(this.world, { seed: this.meta.seed, rng: createRng(this.meta.seed) });
    const save = loadWorld(this.meta.id);
    if (save) this.world.applyEdits(save.edits);
    this.world.recording = true;
    this.spawn = save?.spawn ? { ...save.spawn, yaw: layout.spawn.yaw } : layout.spawn;
    this.time = save?.time ?? this.map.startTime;
    this.mode = save?.mode ?? this.meta.mode;
    this.rules = { ...DEFAULT_RULES, ...save?.rules };
    if (save?.inventory) this.inventory.load(save.inventory);
    else if (this.mode === "creative") this.map.hotbar.forEach((id, i) => this.inventory.set(i, { id, count: 1 }));
    if (save?.vitals) Object.assign(this.vitals, save.vitals);
    this.slot = save?.selectedSlot ?? 0;

    // Rendering
    this.canvas = document.createElement("canvas");
    this.canvas.className = "g-view";
    opts.container.appendChild(this.canvas);
    // Smooth edges unless the chunky retro look is on (chosen when the world is opened).
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !this.settings.retro, powerPreference: "high-performance" });
    this.atlas = paintAtlas();
    this.texture = new THREE.CanvasTexture(this.atlas);
    this.texture.magFilter = this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;

    this.chunks = new ChunkRenderer(this.world, this.texture, this.scene);
    this.chunks.buildAll();
    this.sky = new Sky(this.scene, this.map.sky, this.map.fog);
    this.clouds = new Clouds(this.scene, size.x, size.z, size.y + 2, this.meta.seed);
    this.debris = new Debris(this.scene, this.world);
    this.selection = new BlockSelection(this.scene, this.texture);
    this.items = new ItemEntities(this.scene, this.world, this.texture);
    this.scene.add(this.camera); // so the held item (a child of the camera) renders
    this.ambience = new Ambience(opts.audio, this.map.ambience);
    this.held = new HeldItem(this.camera, this.texture);

    // Player
    this.player = new Player(this.world);
    const sp = save?.player;
    this.player.pos.set(sp?.x ?? this.spawn.x, sp?.y ?? this.spawn.y, sp?.z ?? this.spawn.z);
    this.player.yaw = sp?.yaw ?? this.spawn.yaw;
    this.player.pitch = sp?.pitch ?? 0.12;
    this.player.flying = !!sp?.flying && this.rulesNow.flight;
    if (this.player.collides()) this.respawnAt(this.spawn);
    this.player.resetFall();
    this.rig = new CameraRig(this.camera, this.world);
    this.scene.add(this.character.root);

    // Controls and screens
    const actions: InputActions = {
      use: () => this.use(),
      toggleCamera: () => {
        this.camMode = this.camMode === "first" ? "third" : "first";
      },
      toggleFly: () => this.setFlying(!this.player.flying),
      selectSlot: n => this.select(n),
      cycleSlot: d => this.select(this.slot + d),
      pause: () => this.pause(),
      openInventory: () => this.openInventory(),
      openCommands: prefill => this.openCommands(prefill),
      dropItem: all => this.dropHeld(all),
    };
    this.hud = new Hud(opts.container, this.touch, () => this.pause(), n => this.select(n));
    if (this.touch) {
      this.touchControls = new TouchControls(opts.container, this.canvas, this.input, actions, opts.viewport, this.rulesNow.flight);
    } else {
      this.kbm = new KeyboardMouse(this.canvas, this.input, actions, locked => {
        this.hud.showHint(!locked && !this.paused && !this.uiOpen);
        // Losing the mouse while playing (Esc, alt-tab) pauses; opening a screen doesn't.
        if (!locked && !this.paused && !this.uiOpen) this.pause();
      });
    }
    this.invScreen = new InventoryScreen(
      opts.container,
      this.inventory,
      () => this.closeUi(),
      stack => this.throwStack(stack),
      kind => opts.audio.play(kind),
    );
    this.cmdBar = new CommandBar(
      opts.container,
      line => this.runCommand(line),
      line => this.commands.complete(line, this.commandContext),
      () => this.closeUi(),
    );
    this.death = new DeathScreen(opts.container, () => this.respawn(), () => opts.onExitToMenu());

    this.unsubscribers.push(this.inventory.onChange(() => this.refreshHotbar()));
    this.hud.setFpsVisible(this.settings.showFps);
    this.applyMode();
    this.select(this.slot);

    this.unsubscribers.push(opts.viewport.onChange(this.resize));
    addEventListener("resize", this.resize);
    this.resize();
    if (!save) this.cmdBar.log(`${this.meta.name}: ${MODE_NAMES[this.mode]} mode. Type /help for commands.`, "info");
  }

  private get rulesNow(): ModeRules {
    return MODE_RULES[this.mode];
  }

  private get uiOpen(): boolean {
    return this.invScreen.isOpen || this.cmdBar.isOpen || this.death.isOpen;
  }

  /* ---------- Lifecycle ---------- */

  resume(): void {
    if (!this.paused || this.disposed) return;
    this.paused = false;
    this.setControlsEnabled(!this.uiOpen);
    if (this.kbm && !this.uiOpen) {
      this.hud.showHint(true);
      this.kbm.requestLock();
    }
    if (this.touchControls) {
      this.hud.showHint(true);
      setTimeout(() => this.hud.showHint(false), 4500);
    }
    this.ambience.setActive(true);
    this.lastT = performance.now();
    requestAnimationFrame(this.frame);
  }

  /** Stop the loop. `notify` false is used for cutscenes (no pause menu). */
  pause(notify = true): void {
    if (this.paused) return;
    this.paused = true;
    if (this.invScreen.isOpen) this.invScreen.close();
    if (this.cmdBar.isOpen) this.cmdBar.close();
    this.setControlsEnabled(false);
    this.kbm?.releaseLock();
    this.hud.showHint(false);
    this.ambience.setActive(false);
    this.opts.audio.setUnderwater(false);
    this.save();
    if (notify) this.opts.onPause();
  }

  setSettings(s: Settings): void {
    const cameraChanged = s.camera !== this.settings.camera;
    this.settings = { ...s };
    if (cameraChanged) this.camMode = s.camera;
    this.hud.setFpsVisible(s.showFps);
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
    this.unsubscribers.forEach(u => u());
    this.kbm?.dispose();
    this.touchControls?.dispose();
    this.hud.dispose();
    this.invScreen.dispose();
    this.cmdBar.dispose();
    this.death.dispose();
    this.chunks.dispose();
    this.sky.dispose();
    this.clouds.dispose();
    this.debris.dispose();
    this.selection.dispose();
    this.items.dispose();
    this.ambience.dispose();
    this.held.dispose();
    this.character.dispose();
    this.texture.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }

  private setControlsEnabled(on: boolean): void {
    if (this.kbm) {
      this.kbm.enabled = on;
      if (!on) this.kbm.reset();
    }
    if (this.touchControls) {
      this.touchControls.enabled = on;
      if (!on) this.touchControls.reset();
    }
  }

  /* ---------- Screens ---------- */

  private openInventory(): void {
    if (this.paused || this.uiOpen) return;
    this.setControlsEnabled(false);
    this.kbm?.releaseLock();
    this.hud.showHint(false);
    this.invScreen.open(this.mode, this.slot);
  }

  private openCommands(prefill: string): void {
    if (this.paused || this.uiOpen) return;
    this.setControlsEnabled(false);
    this.kbm?.releaseLock();
    this.hud.showHint(false);
    this.cmdBar.open(prefill);
  }

  private closeUi(): void {
    if (this.paused || this.uiOpen) return;
    this.setControlsEnabled(true);
    if (this.kbm) {
      this.kbm.requestLock();
      // If the browser refuses the mouse capture, "click to play" explains what to do.
      setTimeout(() => this.hud.showHint(!this.kbm?.locked && !this.paused && !this.uiOpen), 150);
    }
  }

  /* ---------- Frame loop ---------- */

  private frame = (now: number): void => {
    if (this.paused || this.disposed) return;
    requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    if (this.quality.sample(dt)) this.resize();
  };

  private update(dt: number): void {
    const { player, input, settings } = this;
    const alive = !this.death.isOpen;
    const audio = this.opts.audio;
    const feet = { x: player.pos.x, y: player.pos.y, z: player.pos.z };

    // Look
    const sens = (0.0008 + settings.look * 0.00045) * (this.touch ? 2.4 : 1);
    player.yaw -= input.lookX * sens;
    player.pitch -= input.lookY * sens * (settings.invertY ? -1 : 1);
    player.pitch = Math.max(-1.55, Math.min(1.55, player.pitch));
    input.lookX = input.lookY = 0;

    // Move
    const ev = player.update(dt, alive ? {
      x: input.moveX, z: input.moveZ, jump: input.jump, sprint: input.sprint && this.vitals.hunger > 6, descend: input.descend,
    } : { x: 0, z: 0, jump: false, sprint: false, descend: false }, this.touch);
    if (ev.step !== null) {
      const d = blockDef(ev.step);
      if (d) audio.step(d.sound, feet);
    }
    if (ev.landed) {
      const d = blockDef(this.world.get(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.1), Math.floor(player.pos.z)));
      if (d) audio.step(d.sound, feet);
      audio.play("land", { at: feet, volume: Math.min(1, 0.4 + ev.fell * 0.1) });
    }
    if (ev.splashed) audio.play("splash", { at: feet });

    // Survival: fall damage, hunger, air
    if (this.rulesNow.vitals && alive) {
      let hurt = ev.fell > 3 ? this.vitals.fall(ev.fell) : 0;
      if (ev.jumped) this.vitals.exert(0.6);
      const eye = player.eye;
      hurt += this.vitals.update(dt, {
        sprinting: player.sprinting,
        moving: player.speed > 0.5,
        submerged: this.world.isWater(Math.floor(eye.x), Math.floor(eye.y), Math.floor(eye.z)),
      });
      if (hurt > 0) {
        this.hud.flashHurt();
        audio.play("hurt");
        navigator.vibrate?.(30);
      }
      if (this.vitals.dead) this.die();
    }
    if (player.pos.y < -10) {
      if (this.rulesNow.vitals && alive) {
        this.vitals.damage(999, "void");
        this.die();
      } else if (!this.rulesNow.vitals) this.respawnAt(this.spawn);
    }
    this.hud.setVitals(this.vitals.health, this.vitals.hunger, this.vitals.air);

    // Camera, character and the item in hand
    this.rig.update(player, this.camMode, dt);
    this.character.root.visible = this.camMode === "third";
    this.character.root.position.copy(player.pos);
    this.character.root.rotation.y = player.yaw;
    this.character.animate(dt, player.speed, player.inWater || player.flying);
    this.held.visible = this.camMode === "first" && alive;

    // Sky and lighting
    if (settings.dayCycle && this.rules.dayCycle) this.time = (this.time + dt / DAY_SECONDS) % 1;
    this.sky.update(this.time, this.camera, this.rig.underwater());
    const light = this.sky.light;
    this.chunks.setLight(light);
    this.clouds.update(dt, light);
    this.debris.update(dt, light);
    this.held.update(dt, player.onGround ? player.speed : 0, light);

    // Dropped items fly into the inventory when you walk over them
    this.items.update(dt, player.pos, light, stack => {
      if (!alive) return stack.count;
      const left = this.inventory.add(stack.id, stack.count, stack.dur);
      if (left < stack.count) {
        audio.play("pickup", { volume: 0.7 });
        this.dirty = true;
      }
      return left;
    });

    if (alive) {
      this.updateTarget();
      this.updateMining(dt);
    } else this.selection.hide();

    // Sound follows the camera; ambience follows the time of day.
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    audio.setListener(this.camera.position, fwd, up);
    audio.setUnderwater(this.rig.underwater());
    this.ambience.update(dt, this.camera.position, Math.max(0, Math.min(1, (light - 0.3) / 0.7)));

    this.hud.tickFps(dt);
    this.saveTimer += dt;
    if (this.dirty && this.saveTimer > 8) this.save();
  }

  /* ---------- Mode ---------- */

  private applyMode(): void {
    const rules = this.rulesNow;
    if (!rules.flight && this.player.flying) this.setFlying(false);
    this.touchControls?.setFlightAllowed(rules.flight);
    this.hud.setVitalsVisible(rules.vitals);
    if (!rules.vitals) this.vitals.reset();
    this.refreshHotbar();
  }

  private setMode(mode: GameMode): void {
    this.mode = mode;
    this.applyMode();
    this.dirty = true;
  }

  private setFlying(on: boolean): boolean {
    if (on && !this.rulesNow.flight) return false;
    this.player.flying = on;
    this.player.vel.y = 0;
    this.player.resetFall();
    this.hud.setFlying(on);
    this.touchControls?.setFlying(on);
    return on;
  }

  /* ---------- Blocks ---------- */

  private get heldStack(): ItemStack | null {
    return this.inventory.get(this.slot);
  }

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
    const id = this.world.get(t.x, t.y, t.z);
    const def = blockDef(id);
    if (!def) return;
    const tool = this.heldStack ? itemDef(this.heldStack.id)?.tool : undefined;
    const info = miningInfo(id, tool);
    const instant = this.rulesNow.instantMine;
    this.mineProgress += instant || info.seconds <= 0 ? 1 : dt / info.seconds;
    this.hitTimer -= dt;
    if (this.hitTimer <= 0 && !instant) {
      this.opts.audio.hit(def.sound, { x: t.x + 0.5, y: t.y + 0.5, z: t.z + 0.5 });
      this.held.swing();
      this.hitTimer = 0.25;
    }
    this.selection.show(t.x, t.y, t.z, this.mineProgress);
    if (this.mineProgress >= 1) {
      this.breakBlock(t, info.drops);
      if (tool && !instant && this.inventory.wear(this.slot)) {
        this.opts.audio.play("toolBreak");
        this.hud.toast("Your tool broke");
      }
      if (this.rulesNow.vitals) this.vitals.exert(0.3);
      this.mineProgress = 0;
      this.mineKey = "";
      this.mineCooldown = instant ? 0.2 : 0.05;
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

  /** Change blocks and refresh the meshes around them. Every world edit goes through here. */
  private editBlocks(cells: Iterable<[number, number, number, number]>): number {
    let n = 0;
    for (const [x, y, z, id] of cells) {
      if (!this.world.inBounds(x, y, z) || this.world.get(x, y, z) === id) continue;
      this.world.set(x, y, z, id);
      this.chunks.markDirty(x, z);
      n++;
    }
    if (n) {
      this.chunks.flush();
      this.dirty = true;
    }
    return n;
  }

  private breakBlock(t: RayHit, drops: boolean): void {
    const id = this.world.get(t.x, t.y, t.z);
    const def = blockDef(id);
    // Water next to the hole flows into it.
    const w = this.world;
    const wet = w.isWater(t.x, t.y + 1, t.z) || w.isWater(t.x + 1, t.y, t.z) || w.isWater(t.x - 1, t.y, t.z) ||
      w.isWater(t.x, t.y, t.z + 1) || w.isWater(t.x, t.y, t.z - 1);
    this.editBlocks([[t.x, t.y, t.z, wet ? Block.Water : Block.Air]]);
    this.debris.burst(t.x, t.y, t.z, this.colorOf(id));
    if (def) this.opts.audio.breakBlock(def.sound, { x: t.x + 0.5, y: t.y + 0.5, z: t.z + 0.5 });
    navigator.vibrate?.(12);
    if (drops && this.rulesNow.drops) {
      for (const d of blockDrops(id, this.rng)) this.items.spawn(d, t.x + 0.5, t.y + 0.5, t.z + 0.5);
    }
  }

  /** Place the held block, or eat the held food. */
  private use(): void {
    if (this.paused || this.death.isOpen) return;
    const stack = this.heldStack;
    const def = stack ? itemDef(stack.id) : undefined;
    if (!stack || !def) return;

    if (def.food !== undefined) {
      if (!this.rulesNow.vitals) return;
      if (this.vitals.eat(def.food)) {
        this.inventory.takeOne(this.slot);
        this.opts.audio.play("eat");
        this.held.swing();
        this.dirty = true;
      } else this.hud.toast("You're full");
      return;
    }
    if (def.block === undefined) return;

    const t = this.target;
    if (!t) return;
    const { px, py, pz } = t;
    if (!this.world.inBounds(px, py, pz)) return;
    const here = this.world.get(px, py, pz);
    if (here !== Block.Air && here !== Block.Water) return;
    if (def.block !== Block.Water && this.player.overlapsBlock(px, py, pz)) return;
    this.editBlocks([[px, py, pz, def.block]]);
    if (!this.rulesNow.infiniteBlocks) this.inventory.takeOne(this.slot);
    const bd = blockDef(def.block);
    if (bd) this.opts.audio.place(bd.sound, { x: px + 0.5, y: py + 0.5, z: pz + 0.5 });
    this.held.swing();
    navigator.vibrate?.(8);
  }

  private select(n: number): void {
    this.slot = ((n % 9) + 9) % 9;
    const s = this.heldStack;
    this.hud.select(this.slot, s);
    this.held.show(s?.id ?? -1);
  }

  private refreshHotbar(): void {
    this.hud.setHotbar(this.inventory.slots, this.rulesNow.infiniteBlocks);
    this.held.show(this.heldStack?.id ?? -1);
  }

  /** Throw the held item forward (Q). */
  private dropHeld(all: boolean): void {
    const s = this.heldStack;
    if (!s) return;
    const n = all ? s.count : 1;
    const thrown = { ...s, count: n };
    this.inventory.set(this.slot, s.count - n > 0 ? { ...s, count: s.count - n } : null);
    this.throwStack(thrown);
  }

  private throwStack(stack: ItemStack): void {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const eye = this.player.eye;
    this.items.spawn(stack, eye.x + dir.x * 0.5, eye.y - 0.3, eye.z + dir.z * 0.5, dir.multiplyScalar(5).add(new THREE.Vector3(0, 1.5, 0)), 1.5);
    this.dirty = true;
  }

  /* ---------- Survival: dying and respawning ---------- */

  private die(): void {
    if (this.death.isOpen) return;
    const p = this.player.pos;
    if (!this.rules.keepInventory) {
      // Everything you carried spills out where you fell.
      for (const s of this.inventory.slots) if (s) this.items.spawn(s, p.x, Math.max(p.y, 1) + 0.6, p.z);
      this.inventory.clear();
    }
    // Show the death screen first: closing the other screens checks it and won't recapture the mouse.
    this.death.show(Vitals.deathMessage(this.vitals.lastCause));
    if (this.invScreen.isOpen) this.invScreen.close();
    if (this.cmdBar.isOpen) this.cmdBar.close();
    this.setControlsEnabled(false);
    this.kbm?.releaseLock();
    this.hud.showHint(false);
    this.opts.audio.play("death");
    this.save();
  }

  private respawn(): void {
    this.death.hide();
    this.opts.audio.play("respawn");
    this.vitals.reset();
    this.respawnAt(this.spawn);
    this.setControlsEnabled(true);
    this.kbm?.requestLock();
    this.save();
  }

  private respawnAt(s: Vec3): void {
    this.player.pos.set(s.x, s.y, s.z);
    // If something was built on the spawn point, start on top of it.
    while (this.player.collides() && this.player.pos.y < this.world.sy) this.player.pos.y += 1;
    this.player.vel.set(0, 0, 0);
    this.player.resetFall();
  }

  /* ---------- Commands ---------- */

  private runCommand(line: string): void {
    const text = line.startsWith("/") ? line : `/${line}`;
    this.cmdBar.log(text, "info");
    const r = this.commands.execute(text, this.commandContext);
    this.cmdBar.log(r.message, r.ok ? "ok" : "error");
    if (r.ok) this.dirty = true;
  }

  /** What commands can see and change. */
  private get commandContext(): CommandContext {
    const g = this;
    return {
      get mode() { return g.mode; },
      setMode: m => g.setMode(m),
      get position() { return { x: g.player.pos.x, y: g.player.pos.y, z: g.player.pos.z }; },
      teleport: (x, y, z) => {
        g.player.pos.set(x, y, z);
        g.player.vel.set(0, 0, 0);
        g.player.resetFall();
      },
      get spawn() { return { x: g.spawn.x, y: g.spawn.y, z: g.spawn.z }; },
      setSpawn: (x, y, z) => { g.spawn = { x, y, z, yaw: g.player.yaw }; },
      give: (id, count) => count - g.inventory.add(id, count),
      clearInventory: () => {
        const n = g.inventory.slots.reduce((a, s) => a + (s?.count ?? 0), 0);
        g.inventory.clear();
        return n;
      },
      get time() { return g.time; },
      setTime: t => { g.time = ((t % 1) + 1) % 1; },
      get rules() { return { ...g.rules }; },
      setRule: (k, v) => { g.rules[k] = v; },
      heal: () => g.vitals.heal(),
      feed: () => g.vitals.feed(),
      kill: () => {
        if (g.rulesNow.vitals) {
          g.vitals.damage(999, "command");
          g.die();
        } else g.respawnAt(g.spawn);
      },
      get flying() { return g.player.flying; },
      setFlying: on => g.setFlying(on),
      get worldSize() { return { x: g.world.sx, y: g.world.sy, z: g.world.sz }; },
      getBlock: (x, y, z) => g.world.get(Math.floor(x), Math.floor(y), Math.floor(z)),
      setBlocks: cells => g.editBlocks(cells),
      get seed() { return g.meta.seed; },
      get worldName() { return g.meta.name; },
    };
  }

  /* ---------- Saving ---------- */

  private save(): void {
    const flat: number[] = [];
    for (const [i, id] of this.world.edits) flat.push(i, id);
    const p = this.player;
    saveWorld(this.meta.id, {
      v: 2,
      mode: this.mode,
      edits: flat,
      player: { x: p.pos.x, y: p.pos.y, z: p.pos.z, yaw: p.yaw, pitch: p.pitch, flying: p.flying },
      time: this.time,
      inventory: this.inventory.save(),
      vitals: { health: this.vitals.health, hunger: this.vitals.hunger, air: this.vitals.air },
      spawn: { x: this.spawn.x, y: this.spawn.y, z: this.spawn.z },
      rules: this.rules,
      selectedSlot: this.slot,
    });
    updateWorldMeta(this.meta.id, { lastPlayed: Date.now(), mode: this.mode });
    this.dirty = false;
    this.saveTimer = 0;
  }

  /* ---------- Sizing ---------- */

  private resize = (): void => {
    const w = this.opts.viewport.width;
    const h = this.opts.viewport.height;
    const dpr = devicePixelRatio || 1;
    // Retro mode renders at low resolution and scales up with hard pixel edges.
    const base = this.settings.retro
      ? Math.min(1, Math.max(320, w / 2) / w)
      : Math.min(dpr, this.touch ? 1.5 : 2);
    // Adaptive quality lowers it further if frames are slow (never below ~240 pixels wide).
    const ratio = Math.max(240 / w, base * this.quality.scale);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h);
    this.canvas.classList.toggle("retro", this.settings.retro);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };
}
