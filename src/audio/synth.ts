/**
 * Building blocks for designing sounds. Sounds are rendered ahead of time with an
 * OfflineAudioContext (faster than real time, no glitches), so each one can use many
 * layers without costing anything during play.
 *
 * - grain:  a tiny burst of filtered noise (dozens make a crunch, a rustle, a footstep)
 * - mode:   a decaying sine at one resonant frequency (several make wood, stone or glass "ring")
 * - sweep:  a sine gliding between pitches (thumps, pops, chirps, chimes)
 */
import type { Rng } from "../core/random";

export const SAMPLE_RATE = 44100;

let noise: AudioBuffer | null = null;

/** Two seconds of white noise, shared by every render. */
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  if (noise && noise.sampleRate === ctx.sampleRate) return noise;
  const len = ctx.sampleRate * 2;
  noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noise.getChannelData(0);
  let seed = 1234567;
  for (let i = 0; i < len; i++) {
    seed = (seed * 1664525 + 1013904223) | 0;
    d[i] = (seed >>> 0) / 2147483648 - 1;
  }
  return noise;
}

export interface Voice {
  ctx: BaseAudioContext;
  out: AudioNode;
  rng: Rng;
}

const env = (g: GainNode, t: number, peak: number, attack: number, decay: number) => {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
};

/** Short burst of band-limited noise. */
export function grain(
  v: Voice, t: number, dur: number, freq: number, q: number, gain: number,
  type: BiquadFilterType = "bandpass",
): void {
  const { ctx, out, rng } = v;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, gain, Math.min(0.004, dur * 0.2), dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, rng() * 1.5, dur + 0.02);
}

/** Many grains scattered over a window: crunches, rustles, scrapes. */
export function crunch(
  v: Voice, t: number, window: number, count: number,
  freq: [number, number], q: number, gain: [number, number], dur: [number, number],
): void {
  const r = v.rng;
  for (let i = 0; i < count; i++) {
    // Earlier grains are a little louder, like a real impact settling.
    const at = t + Math.pow(r(), 1.4) * window;
    const fall = 1 - ((at - t) / Math.max(window, 1e-3)) * 0.5;
    grain(v, at, lerp(dur, r()), lerp(freq, r()), q, lerp(gain, r()) * fall);
  }
}

/** One resonant mode: a sine that rings and dies away. */
export function mode(v: Voice, t: number, freq: number, decay: number, gain: number): void {
  const { ctx, out } = v;
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.value = freq;
  const g = ctx.createGain();
  env(g, t, gain, 0.002, decay);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + decay + 0.05);
}

/** Several modes with small random detuning: the "body" of wood, stone, glass. */
export function modes(v: Voice, t: number, list: [freq: number, decay: number, gain: number][], detune = 0.06): void {
  for (const [f, d, g] of list) mode(v, t, f * (1 + (v.rng() - 0.5) * detune), d, g);
}

/** A sine gliding from f0 to f1: thumps, pops, chimes, chirps. */
export function sweep(
  v: Voice, t: number, f0: number, f1: number, dur: number, gain: number,
  type: OscillatorType = "sine", attack = 0.004,
): void {
  const { ctx, out } = v;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  env(g, t, gain, attack, dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + attack + dur + 0.05);
}

/** A sharp transient at the start of an impact. */
export function click(v: Voice, t: number, gain: number, freq = 4000): void {
  grain(v, t, 0.004, freq, 0.7, gain, "highpass");
}

/** Noise swept through a filter: whooshes and splashes. */
export function swoosh(v: Voice, t: number, dur: number, f0: number, f1: number, gain: number, q = 1.2): void {
  const { ctx, out, rng } = v;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, rng(), dur + 0.05);
}

/** A soft bell: inharmonic partials that fade at different speeds. */
export function bell(v: Voice, t: number, freq: number, gain: number, decay = 0.6): void {
  const partials: [number, number, number][] = [
    [1, 1, 1],
    [2.0, 0.6, 0.35],
    [2.76, 0.45, 0.22],
    [5.4, 0.25, 0.08],
  ];
  for (const [ratio, d, g] of partials) mode(v, t, freq * ratio, decay * d, gain * g);
}

export const lerp = ([a, b]: [number, number], f: number) => a + (b - a) * f;

/** Render a sound design to a buffer. */
export async function render(seconds: number, design: (v: Voice) => void, rng: Rng): Promise<AudioBuffer> {
  const Offline =
    globalThis.OfflineAudioContext ??
    (globalThis as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const ctx = new Offline(1, Math.ceil(seconds * SAMPLE_RATE), SAMPLE_RATE);
  // A gentle high-pass on everything removes rumble that small phone speakers can't play.
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 45;
  hp.connect(ctx.destination);
  design({ ctx, out: hp, rng });
  return ctx.startRendering();
}
