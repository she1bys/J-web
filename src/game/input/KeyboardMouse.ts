import type { InputActions, InputState } from "./InputState";

/**
 * Desktop controls: WASD to move, mouse to look (pointer lock), left button to mine,
 * right button to build, number keys / wheel for blocks.
 */
export class KeyboardMouse {
  private keys = new Set<string>();
  private lastSpace = 0;
  enabled = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private state: InputState,
    private actions: InputActions,
    private onLockChange: (locked: boolean) => void,
  ) {
    canvas.addEventListener("click", this.onCanvasClick);
    canvas.addEventListener("contextmenu", this.prevent);
    canvas.addEventListener("mousedown", this.onMouseDown);
    addEventListener("mouseup", this.onMouseUp);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onPointerLock);
    addEventListener("wheel", this.onWheel, { passive: true });
    addEventListener("keydown", this.onKeyDown);
    addEventListener("keyup", this.onKeyUp);
  }

  get locked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  requestLock(): void {
    try {
      const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      p?.catch?.(() => {});
    } catch {
      /* not allowed outside a click; the "click to play" hint covers it */
    }
  }

  releaseLock(): void {
    if (this.locked) document.exitPointerLock();
  }

  /** Forget held keys (e.g. when pausing) so nothing keeps moving. */
  reset(): void {
    this.keys.clear();
    this.sync();
    this.state.mining = false;
  }

  private prevent = (e: Event) => e.preventDefault();

  private onCanvasClick = () => {
    if (this.enabled && !this.locked) this.requestLock();
  };

  private onMouseDown = (e: MouseEvent) => {
    if (!this.enabled || !this.locked) return;
    if (e.button === 0) this.state.mining = true;
    if (e.button === 2) this.actions.place();
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.state.mining = false;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.enabled || !this.locked) return;
    // Browsers sometimes report one huge jump right after capturing the mouse; ignore it.
    if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
    this.state.lookX += e.movementX;
    this.state.lookY += e.movementY;
  };

  private onPointerLock = () => this.onLockChange(this.locked);

  private onWheel = (e: WheelEvent) => {
    if (this.enabled && this.locked) this.actions.cycleSlot(Math.sign(e.deltaY));
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.enabled) return;
    this.keys.add(e.code);
    if (e.code === "Space" && !e.repeat) {
      const now = performance.now();
      if (now - this.lastSpace < 280) this.actions.toggleFly();
      this.lastSpace = now;
    }
    if (e.code === "KeyV" || e.code === "F5") {
      e.preventDefault();
      this.actions.toggleCamera();
    }
    if (e.code === "KeyF") this.actions.toggleFly();
    if (/^Digit[1-9]$/.test(e.code)) this.actions.selectSlot(Number(e.code.slice(5)) - 1);
    if (e.code === "Escape" || e.code === "KeyP") this.actions.pause();
    if (e.code === "Space") e.preventDefault();
    this.sync();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    this.sync();
  };

  private sync(): void {
    const k = this.keys;
    const s = this.state;
    s.moveX = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
    s.moveZ = (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) - (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0);
    s.jump = k.has("Space");
    s.sprint = k.has("ShiftLeft") || k.has("ControlLeft") || k.has("ShiftRight");
    s.descend = k.has("ShiftLeft") || k.has("ShiftRight");
  }

  dispose(): void {
    this.canvas.removeEventListener("click", this.onCanvasClick);
    this.canvas.removeEventListener("contextmenu", this.prevent);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    removeEventListener("mouseup", this.onMouseUp);
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onPointerLock);
    removeEventListener("wheel", this.onWheel);
    removeEventListener("keydown", this.onKeyDown);
    removeEventListener("keyup", this.onKeyUp);
    this.releaseLock();
  }
}
