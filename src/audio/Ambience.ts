import type { AudioEngine, Vec3 } from "./AudioEngine";

/** How much of each layer a map has, 0–1. */
export interface AmbienceProfile {
  wind: number;
  birds: number;
  waves: number;
  crickets: number;
}

/**
 * The background soundscape of a map, generated live:
 * - wind: filtered noise whose colour and strength drift slowly
 * - waves: low surf that swells and falls every few seconds
 * - birds (by day) and crickets (at night): short calls from random spots around you, in 3D
 */
export class Ambience {
  private nodes: AudioNode[] = [];
  private sources: AudioScheduledSourceNode[] = [];
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private waveGain: GainNode | null = null;
  private out: GainNode | null = null;
  private started = false;
  private active = true;
  private t = 0;
  private windTimer = 0;
  private birdTimer = 2;
  private cricketTimer = 1;

  constructor(private engine: AudioEngine, private profile: AmbienceProfile) {}

  /** Fade the whole soundscape in or out (e.g. while paused). */
  setActive(on: boolean): void {
    this.active = on;
    const ctx = this.engine.ctx;
    if (ctx && this.out) this.out.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.4);
  }

  private start(): void {
    const ctx = this.engine.ctx;
    const bus = this.engine.ambienceOutput;
    if (!ctx || !bus) return;
    this.started = true;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.gain.setTargetAtTime(this.active ? 1 : 0, ctx.currentTime, 1.2);
    this.out.connect(bus);
    this.nodes.push(this.out);

    const noise = this.noiseLoop(ctx);
    if (this.profile.wind > 0) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1400;
      this.windFilter = ctx.createBiquadFilter();
      this.windFilter.type = "bandpass";
      this.windFilter.frequency.value = 450;
      this.windFilter.Q.value = 0.6;
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;
      src.connect(lp).connect(this.windFilter).connect(this.windGain).connect(this.out);
      src.start();
      this.sources.push(src);
      this.nodes.push(lp, this.windFilter, this.windGain);
    }
    if (this.profile.waves > 0) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      src.playbackRate.value = 0.7;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 750;
      this.waveGain = ctx.createGain();
      this.waveGain.gain.value = 0;
      src.connect(lp).connect(this.waveGain).connect(this.out);
      src.start(0, 1.3);
      this.sources.push(src);
      this.nodes.push(lp, this.waveGain);
    }
  }

  /** daylight: 0 at night … 1 at noon. */
  update(dt: number, listener: Vec3, daylight: number): void {
    const ctx = this.engine.ctx;
    if (!ctx || ctx.state !== "running") return;
    if (!this.started) this.start();
    if (!this.active) return;
    this.t += dt;
    const now = ctx.currentTime;

    // Wind drifts to a new colour and strength every couple of seconds.
    this.windTimer -= dt;
    if (this.windGain && this.windFilter && this.windTimer <= 0) {
      this.windTimer = 1.5 + Math.random() * 2.5;
      const gust = 0.45 + Math.random() * 0.55;
      this.windGain.gain.setTargetAtTime(0.34 * this.profile.wind * gust, now, 1.6);
      this.windFilter.frequency.setTargetAtTime(260 + Math.random() * 520 * gust, now, 2);
    }

    // Waves swell and fall on a slow cycle.
    if (this.waveGain) {
      const swell = Math.pow((Math.sin((this.t / 7.5) * Math.PI * 2) + 1) / 2, 2);
      this.waveGain.gain.setTargetAtTime(0.4 * this.profile.waves * (0.15 + 0.85 * swell), now, 0.3);
    }

    // Birds by day
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = 2 + Math.random() * 6;
      const amount = this.profile.birds * Math.max(0, daylight - 0.35) / 0.65;
      if (amount > 0.05 && Math.random() < 0.85) this.bird(listener, amount);
    }

    // Crickets at night
    this.cricketTimer -= dt;
    if (this.cricketTimer <= 0) {
      this.cricketTimer = 0.25 + Math.random() * 0.8;
      const amount = this.profile.crickets * Math.max(0, 0.45 - daylight) / 0.45;
      if (amount > 0.05) this.cricket(listener, amount);
    }
  }

  private around(listener: Vec3, rMin: number, rMax: number, h: [number, number]): Vec3 {
    const a = Math.random() * Math.PI * 2;
    const r = rMin + Math.random() * (rMax - rMin);
    return { x: listener.x + Math.cos(a) * r, y: listener.y + h[0] + Math.random() * (h[1] - h[0]), z: listener.z + Math.sin(a) * r };
  }

  /** A short phrase of chirps: sine sweeps with a fast warble, from somewhere up in the trees. */
  private bird(listener: Vec3, amount: number): void {
    const ctx = this.engine.ctx!;
    const pan = this.engine.spatial(this.around(listener, 8, 22, [3, 9]), "ambience", 4);
    if (!pan || !this.out) return;
    pan.disconnect();
    pan.connect(this.out);
    const base = 2300 + Math.random() * 2200;
    const notes = 2 + Math.floor(Math.random() * 4);
    let t = ctx.currentTime + 0.05;
    for (let i = 0; i < notes; i++) {
      const dur = 0.05 + Math.random() * 0.09;
      const o = ctx.createOscillator();
      const f0 = base * (0.85 + Math.random() * 0.3);
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * (Math.random() < 0.5 ? 1.35 : 0.72), t + dur);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 30 + Math.random() * 45;
      const depth = ctx.createGain();
      depth.gain.value = 120 + Math.random() * 260;
      lfo.connect(depth).connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09 * amount, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(pan);
      o.start(t);
      lfo.start(t);
      o.stop(t + dur + 0.02);
      lfo.stop(t + dur + 0.02);
      t += dur + 0.03 + Math.random() * 0.12;
    }
    setTimeout(() => pan.disconnect(), (t - ctx.currentTime + 0.5) * 1000);
  }

  /** A cricket's trill: a few very short high pulses, from the grass nearby. */
  private cricket(listener: Vec3, amount: number): void {
    const ctx = this.engine.ctx!;
    const pan = this.engine.spatial(this.around(listener, 5, 16, [-1, 0.5]), "ambience", 3);
    if (!pan || !this.out) return;
    pan.disconnect();
    pan.connect(this.out);
    const f = 4200 + Math.random() * 700;
    let t = ctx.currentTime + 0.02;
    const pulses = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < pulses; i++) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.035 * amount, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.022);
      o.connect(g).connect(pan);
      o.start(t);
      o.stop(t + 0.03);
      t += 0.045;
    }
    setTimeout(() => pan.disconnect(), (t - ctx.currentTime + 0.3) * 1000);
  }

  private noiseLoop(ctx: BaseAudioContext): AudioBuffer {
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    // Pinkish noise: sounds softer and more natural than white noise
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
    }
    return buf;
  }

  dispose(): void {
    const ctx = this.engine.ctx;
    if (ctx && this.out) this.out.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    setTimeout(() => {
      this.sources.forEach(s => {
        try {
          s.stop();
        } catch {
          /* already stopped */
        }
      });
      this.nodes.forEach(n => n.disconnect());
    }, 600);
  }
}
