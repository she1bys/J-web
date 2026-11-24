import * as THREE from "three";
import type { World } from "../world/World";

/** What the controls are asking the player to do this frame. */
export interface MoveIntent {
  /** Strafe (-1 left … 1 right) and forward (-1 forward … 1 back), camera-relative. */
  x: number;
  z: number;
  jump: boolean;
  sprint: boolean;
  descend: boolean;
}

export interface PlayerEvents {
  jumped: boolean;
  landed: boolean;
  /** Set when a footstep should sound: the block underfoot. */
  step: number | null;
  splashed: boolean;
  /** Blocks fallen before landing (0 if no hard landing). */
  fell: number;
}

const HALF_WIDTH = 0.3;
const HEIGHT = 1.8;
export const EYE_HEIGHT = 1.62;

const WALK = 4.3;
const SPRINT = 6.4;
const FLY = 10;
const SWIM = 2.8;
const GRAVITY = 24;
const JUMP = 8.2;

/** Position, velocity and collision against the block grid. */
export class Player {
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  onGround = false;
  inWater = false;
  flying = false;
  sprinting = false;
  /** Horizontal speed this frame, for animation. */
  speed = 0;
  private stepDistance = 0;
  /** Highest point since last standing, for fall damage. */
  private peakY = 0;

  constructor(private world: World) {}

  /** Reset fall tracking (after teleporting). */
  resetFall(): void {
    this.peakY = this.pos.y;
  }

  get eye(): THREE.Vector3 {
    return new THREE.Vector3(this.pos.x, this.pos.y + EYE_HEIGHT, this.pos.z);
  }

  /** Does the player's box overlap any solid block? */
  collides(): boolean {
    const p = this.pos;
    const x0 = Math.floor(p.x - HALF_WIDTH + 1e-4);
    const x1 = Math.floor(p.x + HALF_WIDTH - 1e-4);
    const y0 = Math.floor(p.y + 1e-4);
    const y1 = Math.floor(p.y + HEIGHT - 1e-4);
    const z0 = Math.floor(p.z - HALF_WIDTH + 1e-4);
    const z1 = Math.floor(p.z + HALF_WIDTH - 1e-4);
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) if (this.world.isSolid(x, y, z)) return true;
      }
    }
    return false;
  }

  /** Would a block at (x, y, z) overlap the player? (So you can't build inside yourself.) */
  overlapsBlock(x: number, y: number, z: number): boolean {
    const p = this.pos;
    return x + 1 > p.x - HALF_WIDTH && x < p.x + HALF_WIDTH &&
      z + 1 > p.z - HALF_WIDTH && z < p.z + HALF_WIDTH &&
      y + 1 > p.y && y < p.y + HEIGHT;
  }

  /** Move along one axis; on contact, snap flush against the block. Returns true if blocked. */
  private moveAxis(axis: "x" | "y" | "z", d: number): boolean {
    if (!d) return false;
    const before = this.pos[axis];
    this.pos[axis] += d;
    if (!this.collides()) return false;
    const p = this.pos;
    if (axis === "y") p.y = d < 0 ? Math.floor(p.y) + 1 : Math.floor(p.y + HEIGHT) - HEIGHT - 1e-4;
    else p[axis] = d > 0 ? Math.floor(p[axis] + HALF_WIDTH) - HALF_WIDTH - 1e-4 : Math.floor(p[axis] - HALF_WIDTH) + 1 + HALF_WIDTH + 1e-4;
    if (this.collides()) p[axis] = before;
    return true;
  }

  update(dt: number, input: MoveIntent, autoJump: boolean): PlayerEvents {
    const ev: PlayerEvents = { jumped: false, landed: false, step: null, splashed: false, fell: 0 };
    const w = this.world;
    const p = this.pos;
    const v = this.vel;

    const wasInWater = this.inWater;
    this.inWater = w.isWater(Math.floor(p.x), Math.floor(p.y + 0.4), Math.floor(p.z));
    if (this.inWater && !wasInWater && v.y < -4) ev.splashed = true;

    let mx = input.x;
    let mz = input.z;
    const m = Math.hypot(mx, mz);
    if (m > 1) { mx /= m; mz /= m; }
    this.sprinting = input.sprint && m > 0.1 && !this.inWater && mz < 0;
    const speed = this.flying ? FLY : this.inWater ? SWIM : this.sprinting ? SPRINT : WALK;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    v.x = (mx * cos + mz * sin) * speed;
    v.z = (-mx * sin + mz * cos) * speed;

    if (this.flying) {
      v.y = ((input.jump ? 1 : 0) - (input.descend ? 1 : 0)) * 7;
    } else if (this.inWater) {
      v.y = Math.max(-3, v.y - 8 * dt);
      if (input.jump) v.y = Math.min(v.y + 20 * dt, 3.4);
    } else {
      v.y = Math.max(-40, v.y - GRAVITY * dt);
      if (input.jump && this.onGround) {
        v.y = JUMP;
        ev.jumped = true;
      }
    }

    const fallSpeed = v.y;
    const bx = this.moveAxis("x", v.x * dt);
    const bz = this.moveAxis("z", v.z * dt);
    // Hop up one block automatically when walking into it (touch), or to climb out of water.
    if ((bx || bz) && m > 0.3 && !this.flying) {
      if ((autoJump && this.onGround) || (this.inWater && input.jump)) {
        v.y = this.inWater ? 6.5 : JUMP;
        ev.jumped = !this.inWater;
      }
    }
    const hitY = this.moveAxis("y", v.y * dt);
    const wasOnGround = this.onGround;
    this.onGround = hitY && v.y < 0;
    if (hitY) v.y = 0;
    if (this.onGround && !wasOnGround && fallSpeed < -6) ev.landed = true;
    if (this.onGround && !wasOnGround) ev.fell = Math.max(0, this.peakY - p.y);
    if (this.onGround || this.inWater || this.flying) this.peakY = p.y;
    else this.peakY = Math.max(this.peakY, p.y);
    if (this.onGround && this.flying) this.flying = false;

    this.speed = Math.hypot(v.x, v.z);
    if (this.onGround && this.speed > 0.5) {
      this.stepDistance += this.speed * dt;
      if (this.stepDistance > 2.1) {
        this.stepDistance = 0;
        ev.step = w.get(Math.floor(p.x), Math.floor(p.y - 0.1), Math.floor(p.z));
      }
    }
    return ev;
  }
}
