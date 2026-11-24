import { isTouchDevice } from "./timeline";

/**
 * Keeps gameplay in landscape. On phones that allow it (most Android browsers) we go
 * fullscreen and lock the orientation. Where that isn't allowed (iPhone Safari), the play
 * layer is rotated 90° with CSS while the phone is held upright, so the game still shows
 * in landscape, and touch positions are converted to match.
 */
export class Viewport {
  /** True while the play layer is rotated by CSS. */
  rotated = false;
  private active = false;
  private listeners = new Set<() => void>();

  constructor(private layer: HTMLElement) {
    addEventListener("resize", this.update);
    addEventListener("orientationchange", this.update);
    this.update();
  }

  /** Landscape handling applies only while a map is being played. */
  setActive(on: boolean): void {
    this.active = on;
    this.update();
  }

  /** Size of the play area in its own (possibly rotated) coordinates. */
  get width(): number {
    return this.rotated ? innerHeight : innerWidth;
  }

  get height(): number {
    return this.rotated ? innerWidth : innerHeight;
  }

  /** Convert a screen point to play-layer coordinates. */
  toLocal(clientX: number, clientY: number): { x: number; y: number } {
    return this.rotated ? { x: clientY, y: innerWidth - clientX } : { x: clientX, y: clientY };
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Ask for fullscreen + landscape lock. Must be called from a tap/click. */
  static requestLandscape(): void {
    if (!isTouchDevice()) return;
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    const lock = () => {
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      o?.lock?.("landscape").catch(() => {});
    };
    try {
      if (el.requestFullscreen) el.requestFullscreen({ navigationUI: "hide" }).then(lock, lock);
      else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
        lock();
      } else lock();
    } catch {
      lock();
    }
  }

  private update = (): void => {
    const rotate = this.active && isTouchDevice() && innerHeight > innerWidth;
    this.rotated = rotate;
    const s = this.layer.style;
    if (rotate) {
      s.width = `${innerHeight}px`;
      s.height = `${innerWidth}px`;
      s.left = `${innerWidth}px`;
      s.top = "0px";
      s.transformOrigin = "0 0";
      s.transform = "rotate(90deg)";
    } else {
      s.width = s.height = s.left = s.top = s.transform = s.transformOrigin = "";
    }
    this.layer.classList.toggle("rotated", rotate);
    this.listeners.forEach(fn => fn());
  };
}
