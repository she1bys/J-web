import type { InputActions, InputState } from "./InputState";
import type { Viewport } from "../../core/viewport";

/** Keep receiving a finger's moves even if it slides off the element. Some browsers can refuse; that's fine. */
const capture = (el: Element, id: number) => {
  try {
    el.setPointerCapture(id);
  } catch {
    /* the finger is still tracked by id */
  }
};

/**
 * Phone and tablet controls, built for landscape and thumbs:
 * - Left half: a joystick appears wherever your thumb lands. Push it to the edge to sprint.
 * - Right half: drag anywhere to look around.
 * - Right thumb buttons: JUMP (big), MINE (hold), BUILD (tap). Double-tap JUMP to fly in creative.
 * - Top bar: camera, fly and pause.
 */
export class TouchControls {
  readonly root: HTMLElement;
  private stick: HTMLElement;
  private knob: HTMLElement;
  private flyBtn: HTMLButtonElement;
  private stickId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private lookId: number | null = null;
  private last = { x: 0, y: 0 };
  private lastJump = 0;
  enabled = false;

  constructor(
    parent: HTMLElement,
    private surface: HTMLElement,
    private state: InputState,
    private actions: InputActions,
    private viewport: Viewport,
    allowFlight: boolean,
  ) {
    this.root = document.createElement("div");
    this.root.className = "t-root";
    this.root.innerHTML = `
      <div class="t-stick"><div class="t-knob"></div></div>
      <div class="t-actions">
        <button class="t-btn t-mine" type="button">MINE</button>
        <button class="t-btn t-build" type="button">BUILD</button>
        <button class="t-btn t-jump" type="button">JUMP</button>
      </div>
      <div class="t-top">
        <button class="t-btn t-small t-cam" type="button">CAM</button>
        <button class="t-btn t-small t-fly" type="button">FLY</button>
      </div>`;
    parent.appendChild(this.root);
    this.stick = this.root.querySelector(".t-stick")!;
    this.knob = this.root.querySelector(".t-knob")!;
    this.flyBtn = this.root.querySelector(".t-fly")!;
    this.flyBtn.hidden = !allowFlight;

    surface.addEventListener("pointerdown", this.onDown);
    surface.addEventListener("pointermove", this.onMove);
    surface.addEventListener("pointerup", this.onUp);
    surface.addEventListener("pointercancel", this.onUp);

    this.hold(".t-mine", on => { this.state.mining = on; });
    this.hold(".t-jump", on => {
      this.state.jump = on;
      if (!on) return;
      const now = performance.now();
      if (now - this.lastJump < 300) this.actions.toggleFly();
      this.lastJump = now;
    });
    this.tap(".t-build", () => this.actions.place());
    this.tap(".t-cam", () => this.actions.toggleCamera());
    this.tap(".t-fly", () => this.actions.toggleFly());
  }

  setFlying(on: boolean): void {
    this.flyBtn.classList.toggle("on", on);
  }

  reset(): void {
    this.stickId = null;
    this.lookId = null;
    this.state.moveX = this.state.moveZ = 0;
    this.state.jump = this.state.mining = this.state.sprint = false;
    this.stick.classList.remove("on");
    this.root.querySelectorAll(".down").forEach(b => b.classList.remove("down"));
  }

  private hold(sel: string, set: (on: boolean) => void): void {
    const b = this.root.querySelector<HTMLElement>(sel)!;
    b.addEventListener("pointerdown", e => {
      e.preventDefault();
      e.stopPropagation();
      capture(b, e.pointerId);
      b.classList.add("down");
      set(true);
      navigator.vibrate?.(6);
    });
    const off = () => {
      b.classList.remove("down");
      set(false);
    };
    b.addEventListener("pointerup", off);
    b.addEventListener("pointercancel", off);
  }

  private tap(sel: string, run: () => void): void {
    const b = this.root.querySelector<HTMLElement>(sel)!;
    b.addEventListener("pointerdown", e => {
      e.preventDefault();
      e.stopPropagation();
      b.classList.add("down");
      run();
      navigator.vibrate?.(6);
    });
    const off = () => b.classList.remove("down");
    b.addEventListener("pointerup", off);
    b.addEventListener("pointercancel", off);
    b.addEventListener("pointerleave", off);
  }

  private onDown = (e: PointerEvent) => {
    if (!this.enabled || e.pointerType === "mouse") return;
    const local = this.viewport.toLocal(e.clientX, e.clientY);
    if (local.x < this.viewport.width * 0.45 && this.stickId === null) {
      // Joystick: centre it under the thumb.
      this.stickId = e.pointerId;
      this.stickOrigin = local;
      this.stick.style.left = `${local.x}px`;
      this.stick.style.top = `${local.y}px`;
      this.stick.classList.add("on");
      this.knob.style.transform = "translate(-50%, -50%)";
    } else if (this.lookId === null) {
      this.lookId = e.pointerId;
      this.last = local;
    } else return;
    capture(this.surface, e.pointerId);
  };

  private onMove = (e: PointerEvent) => {
    if (!this.enabled) return;
    const local = this.viewport.toLocal(e.clientX, e.clientY);
    if (e.pointerId === this.stickId) {
      const R = 52;
      let dx = local.x - this.stickOrigin.x;
      let dy = local.y - this.stickOrigin.y;
      const m = Math.hypot(dx, dy);
      if (m > R) {
        dx *= R / m;
        dy *= R / m;
      }
      this.state.moveX = dx / R;
      this.state.moveZ = dy / R;
      // Pushing all the way forward sprints.
      this.state.sprint = m > R * 1.15 && dy < -R * 0.6;
      this.stick.classList.toggle("sprint", this.state.sprint);
      this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    } else if (e.pointerId === this.lookId) {
      this.state.lookX += local.x - this.last.x;
      this.state.lookY += local.y - this.last.y;
      this.last = local;
    }
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId === this.stickId) {
      this.stickId = null;
      this.state.moveX = this.state.moveZ = 0;
      this.state.sprint = false;
      this.stick.classList.remove("on", "sprint");
    }
    if (e.pointerId === this.lookId) this.lookId = null;
  };

  dispose(): void {
    this.surface.removeEventListener("pointerdown", this.onDown);
    this.surface.removeEventListener("pointermove", this.onMove);
    this.surface.removeEventListener("pointerup", this.onUp);
    this.surface.removeEventListener("pointercancel", this.onUp);
    this.root.remove();
  }
}
