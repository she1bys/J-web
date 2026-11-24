/**
 * Tiny sound-effect synthesiser. Every sound is generated in code with the Web Audio API,
 * so there are no audio files to load. Sounds only start after the first tap or click,
 * as browsers require.
 */
export type Material = "grass" | "dirt" | "stone" | "wood" | "sand" | "snow" | "glass" | "water" | "leaves";

export class Sfx {
  enabled = true;
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private master: GainNode | null = null;

  /** Call from a user gesture (tap/click/key) to unlock audio. */
  unlock(): void {
    // On iPhone, play through the silent switch like a game or video would.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) {
      try { session.type = "playback"; } catch { /* older Safari */ }
    }
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
  }

  private sfxBus: GainNode | null = null;

  private ready(): AudioContext | null {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
    return this.enabled && this.ctx && this.master ? this.ctx : null;
  }

  /** A short burst of filtered noise: crunches, steps, thuds. */
  private burst(freq: number, q: number, duration: number, volume: number, type: BiquadFilterType = "bandpass"): void {
    const ctx = this.ready();
    if (!ctx || !this.noise || !this.master) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter).connect(gain).connect(this.sfxBus ?? this.master);
    src.start(t, Math.random() * 0.5, duration + 0.05);
  }

  /** A short square-wave note, for UI and rewards. */
  private tone(freq: number, start: number, duration: number, volume = 0.12, type: OscillatorType = "square"): void {
    const ctx = this.ready();
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    const t = ctx.currentTime + start;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(this.sfxBus ?? this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private static readonly MATERIAL: Record<Material, [freq: number, q: number]> = {
    grass: [1800, 0.8],
    leaves: [2600, 0.6],
    dirt: [900, 0.9],
    sand: [3200, 0.5],
    snow: [2400, 0.4],
    stone: [600, 2.5],
    wood: [420, 3],
    glass: [5200, 4],
    water: [700, 0.4],
  };

  hit(m: Material): void {
    const [f, q] = Sfx.MATERIAL[m];
    this.burst(f, q, 0.06, 0.25);
  }

  breakBlock(m: Material): void {
    const [f, q] = Sfx.MATERIAL[m];
    this.burst(f, q, 0.22, 0.6);
    this.burst(f * 0.5, q, 0.18, 0.4);
  }

  place(m: Material): void {
    const [f, q] = Sfx.MATERIAL[m];
    this.burst(f * 0.7, q, 0.1, 0.5);
  }

  step(m: Material): void {
    const [f, q] = Sfx.MATERIAL[m];
    this.burst(f, q, 0.07, 0.12);
  }

  splash(): void {
    this.burst(900, 0.4, 0.35, 0.4, "lowpass");
  }

  click(): void {
    this.tone(660, 0, 0.05, 0.06);
  }

  collect(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.07, 0.14, 0.09));
  }

  fanfare(): void {
    [523, 659, 784, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.12, 0.22, 0.1));
  }
}
