/**
 * Gentle background music composed on the fly: a soft pad, a bass note and a slow
 * pentatonic melody that wanders but always resolves. Nothing is pre-recorded.
 */
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16]; // major pentatonic over two octaves
const CHORDS = [
  [0, 4, 7],
  [-3, 0, 4],
  [-7, -3, 0],
  [-5, -1, 2],
]; // I – vi – IV – V, in semitones from the root

export class Music {
  enabled = true;
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private timer = 0;
  private nextAt = 0;
  private bar = 0;
  private step = 0;
  private note = 2;
  private root = 60; // C4

  attach(ctx: AudioContext, destination: AudioNode): void {
    if (this.ctx) return;
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(destination);
  }

  /** Fade the music in (or out) and keep scheduling notes while on. */
  setPlaying(on: boolean): void {
    if (!this.ctx || !this.out) return;
    const t = this.ctx.currentTime;
    const target = on && this.enabled ? 0.5 : 0;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(target, t, 0.6);
    if (target > 0 && !this.timer) {
      this.nextAt = t + 0.1;
      this.timer = window.setInterval(this.schedule, 100);
    } else if (target === 0 && this.timer) {
      window.clearInterval(this.timer);
      this.timer = 0;
    }
  }

  private freq(semitone: number): number {
    return 440 * Math.pow(2, (this.root + semitone - 69) / 12);
  }

  private voice(type: OscillatorType, semitone: number, start: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = this.freq(semitone);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + Math.min(0.08, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(this.out!);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  /** Schedule notes a little ahead of time so playback stays smooth. */
  private schedule = (): void => {
    const ctx = this.ctx;
    if (!ctx) return;
    const beat = 0.5; // 120 bpm, eighth = 0.25
    while (this.nextAt < ctx.currentTime + 0.4) {
      const t = this.nextAt;
      const chord = CHORDS[this.bar % CHORDS.length];
      if (this.step === 0) {
        chord.forEach(n => this.voice("triangle", n, t, beat * 4, 0.025));
        this.voice("sine", chord[0] - 12, t, beat * 4, 0.06);
      }
      // Melody: a gentle random walk on the scale, resting now and then.
      if (Math.random() < 0.6) {
        this.note = Math.max(0, Math.min(SCALE.length - 1, this.note + Math.round((Math.random() - 0.5) * 3)));
        const len = Math.random() < 0.3 ? beat : beat / 2;
        this.voice("square", SCALE[this.note] + 12, t, len * 0.9, 0.018);
      }
      this.nextAt += beat / 2;
      this.step = (this.step + 1) % 8;
      if (this.step === 0) this.bar++;
    }
  };
}
