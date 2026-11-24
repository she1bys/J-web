/** Run a list of [delayMs, action] steps on animation frames. Resolves when all have run. */
export type Step = [at: number, run: () => void];

export function runTimeline(steps: Step[]): Promise<void> {
  steps.sort((a, b) => a[0] - b[0]);
  return new Promise(resolve => {
    const t0 = performance.now();
    let k = 0;
    const tick = (now: number) => {
      while (k < steps.length && steps[k][0] <= now - t0) steps[k++][1]();
      if (k < steps.length) requestAnimationFrame(tick);
      else resolve();
    };
    tick(t0);
  });
}

export const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export const prefersReducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export const isTouchDevice = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
