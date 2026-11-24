import { createRng } from "../core/random";
import { render } from "./synth";
import { SOUNDS, type Material } from "./sounds";

export type { Material } from "./sounds";

export interface Vec3 { x: number; y: number; z: number }

export interface PlayOptions {
  /** World position for 3D sound; omit for sounds "in your head" (UI, your own footsteps). */
  at?: Vec3;
  /** Extra volume multiplier. */
  volume?: number;
}

/** Scale a rendered sound so its loudest point is the same for every sound; mixing is then set by each design's volume. */
function normalize(buf: AudioBuffer, peak = 0.8): AudioBuffer {
  const d = buf.getChannelData(0);
  let max = 0;
  for (let i = 0; i < d.length; i++) max = Math.max(max, Math.abs(d[i]));
  if (max > 1e-4) {
    const k = peak / max;
    for (let i = 0; i < d.length; i++) d[i] *= k;
  }
  return buf;
}

/** Most sounds that can play at once; extra ones are skipped rather than turning to mush. */
const MAX_VOICES = 28;

/**
 * The game's sound system.
 *
 *   sounds ─┬─────────────► effects bus ─┐
 *           └─► reverb ────────────────► ├─► underwater filter ─► master ─► limiter ─► speakers
 *   ambience ──────────────► ambience bus┘
 *
 * Sounds are rendered once, ahead of time, in several variants (see sounds.ts), then played
 * from memory with a little random pitch, optionally positioned in 3D around the listener.
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private muffle!: BiquadFilterNode;
  private sfxBus!: GainNode;
  private ambBus!: GainNode;
  private reverbSend!: GainNode;
  private buffers = new Map<string, AudioBuffer[]>();
  private loading = new Map<string, Promise<void>>();
  private voices = 0;
  private rng = createRng(77);
  private sfxVolume = 0.8;
  private ambienceVolume = 0.6;

  /** Call from a tap/click/key: browsers only allow sound after a user gesture. */
  unlock(): void {
    // On iPhone, play through the silent switch like a game or video would.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) {
      try {
        session.type = "playback";
      } catch {
        /* older Safari */
      }
    }
    if (this.ctx) {
      if (this.ctx.state !== "running") void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor({ latencyHint: "interactive" });
    this.ctx = ctx;

    // Gentle limiter so many sounds at once never distort.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 8;
    limiter.ratio.value = 10;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    limiter.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(limiter);
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = "lowpass";
    this.muffle.frequency.value = 20000;
    this.muffle.Q.value = 0.5;
    this.muffle.connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.muffle);
    this.ambBus = ctx.createGain();
    this.ambBus.connect(this.muffle);
    const reverb = ctx.createConvolver();
    reverb.buffer = this.impulse(ctx, 1.6);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.22;
    this.reverbSend.connect(reverb).connect(this.muffle);
    this.applyVolumes();

    void this.prewarm();
  }

  get ready(): boolean {
    return !!this.ctx;
  }

  /** Output for continuous ambience (wind, waves, birds). */
  get ambienceOutput(): AudioNode | null {
    return this.ctx ? this.ambBus : null;
  }

  /** 0–1 each. */
  setVolumes(sfx: number, ambience: number): void {
    this.sfxVolume = sfx;
    this.ambienceVolume = ambience;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(this.sfxVolume, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.ambienceVolume, t, 0.3);
  }

  /** Muffle everything while the camera is under water. */
  setUnderwater(on: boolean): void {
    if (!this.ctx) return;
    this.muffle.frequency.setTargetAtTime(on ? 650 : 20000, this.ctx.currentTime, 0.08);
  }

  /** Where the listener (camera) is and which way it faces. */
  setListener(pos: Vec3, forward: Vec3, up: Vec3): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const l = ctx.listener;
    const t = ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(pos.x, t, 0.02);
      l.positionY.setTargetAtTime(pos.y, t, 0.02);
      l.positionZ.setTargetAtTime(pos.z, t, 0.02);
      l.forwardX.setTargetAtTime(forward.x, t, 0.02);
      l.forwardY.setTargetAtTime(forward.y, t, 0.02);
      l.forwardZ.setTargetAtTime(forward.z, t, 0.02);
      l.upX.setTargetAtTime(up.x, t, 0.02);
      l.upY.setTargetAtTime(up.y, t, 0.02);
      l.upZ.setTargetAtTime(up.z, t, 0.02);
    } else {
      // Older Safari
      const legacy = l as AudioListener & {
        setPosition(x: number, y: number, z: number): void;
        setOrientation(x: number, y: number, z: number, ux: number, uy: number, uz: number): void;
      };
      legacy.setPosition(pos.x, pos.y, pos.z);
      legacy.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
    }
  }

  /** A 3D panner at a world position, feeding the given bus. */
  spatial(at: Vec3, bus: "sfx" | "ambience" = "sfx", refDistance = 2.5): PannerNode | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const p = ctx.createPanner();
    p.panningModel = "HRTF";
    p.distanceModel = "inverse";
    p.refDistance = refDistance;
    p.maxDistance = 60;
    p.rolloffFactor = 1.1;
    if (p.positionX) {
      p.positionX.value = at.x;
      p.positionY.value = at.y;
      p.positionZ.value = at.z;
    } else (p as PannerNode & { setPosition(x: number, y: number, z: number): void }).setPosition(at.x, at.y, at.z);
    p.connect(bus === "sfx" ? this.sfxBus : this.ambBus);
    return p;
  }

  play(name: string, opts: PlayOptions = {}): void {
    const ctx = this.ctx;
    const design = SOUNDS[name];
    if (!ctx || !design || this.sfxVolume <= 0 || ctx.state !== "running") return;
    const list = this.buffers.get(name);
    if (!list) {
      void this.load(name);
      return;
    }
    if (this.voices >= MAX_VOICES) return;
    const src = ctx.createBufferSource();
    src.buffer = list[Math.floor(this.rng() * list.length)];
    src.playbackRate.value = 1 + (this.rng() - 0.5) * design.pitch;
    const g = ctx.createGain();
    g.gain.value = design.volume * (opts.volume ?? 1);
    src.connect(g);
    const target = opts.at ? this.spatial(opts.at) : this.sfxBus;
    if (!target) return;
    g.connect(target);
    g.connect(this.reverbSend);
    this.voices++;
    src.onended = () => {
      this.voices--;
      src.disconnect();
      g.disconnect();
      if (target !== this.sfxBus) target.disconnect();
    };
    src.start();
  }

  /* Convenience names used by the game */
  step(m: Material, at?: Vec3): void {
    this.play(`step.${m}`, { at });
  }
  hit(m: Material, at?: Vec3): void {
    this.play(`hit.${m}`, { at });
  }
  breakBlock(m: Material, at?: Vec3): void {
    this.play(`break.${m}`, { at });
  }
  place(m: Material, at?: Vec3): void {
    this.play(`place.${m}`, { at });
  }
  click(): void {
    this.play("click");
  }

  /* ---------- Rendering sounds ---------- */

  private load(name: string): Promise<void> {
    let p = this.loading.get(name);
    if (p) return p;
    const design = SOUNDS[name];
    p = (async () => {
      const out: AudioBuffer[] = [];
      for (let i = 0; i < design.variants; i++) {
        let seed = 0;
        for (const ch of name) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) | 0;
        out.push(normalize(await render(design.seconds, design.design, createRng(seed + i * 7919))));
      }
      this.buffers.set(name, out);
    })().catch(() => {
      this.loading.delete(name); // try again next time
    });
    this.loading.set(name, p);
    return p;
  }

  /** Render everything in the background, interface sounds first. */
  private async prewarm(): Promise<void> {
    const names = Object.keys(SOUNDS);
    const first = ["click", "open", "close", "pickup", "drop", "craft", "error"];
    const order = [...first, ...names.filter(n => n.startsWith("step.")), ...names.filter(n => !first.includes(n) && !n.startsWith("step."))];
    for (const n of order) {
      await this.load(n);
      // Let the game breathe between renders.
      await new Promise(r => setTimeout(r, 0));
    }
  }

  /** A soft outdoor room: decaying stereo noise, darker as it fades. */
  private impulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    const r = createRng(9);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const k = 0.35 + 0.6 * t; // more smoothing (darker) as it decays
        lp += (r() * 2 - 1 - lp) * (1 - k);
        d[i] = lp * Math.pow(1 - t, 2.6) * (i < ctx.sampleRate * 0.012 ? i / (ctx.sampleRate * 0.012) : 1);
      }
    }
    return buf;
  }
}
