/** Health, hunger and air for survival mode. All values are in half-icons (20 = 10 full hearts). */
export type DamageCause = "fall" | "drown" | "starve" | "void" | "command";

export interface VitalsInput {
  sprinting: boolean;
  moving: boolean;
  /** Head under water. */
  submerged: boolean;
}

export const MAX_HEALTH = 20;
export const MAX_HUNGER = 20;
export const MAX_AIR = 10;

/** Seconds of normal activity per hunger point lost. */
const HUNGER_SECONDS = 40;

export class Vitals {
  health = MAX_HEALTH;
  hunger = MAX_HUNGER;
  air = MAX_AIR;
  lastCause: DamageCause | null = null;
  private exhaustion = 0;
  private regen = 0;
  private starve = 0;
  private drown = 0;

  get dead(): boolean {
    return this.health <= 0;
  }

  /** Advance one frame. Returns damage taken this frame (for the red flash). */
  update(dt: number, input: VitalsInput): number {
    if (this.dead) return 0;
    let damage = 0;

    // Hunger: drains slowly, faster when sprinting.
    this.exhaustion += dt * (input.sprinting ? 3 : input.moving ? 1.2 : 1);
    if (this.exhaustion >= HUNGER_SECONDS) {
      this.exhaustion -= HUNGER_SECONDS;
      this.hunger = Math.max(0, this.hunger - 1);
    }

    // Well fed: heal. Starving: hurt.
    if (this.hunger >= 16 && this.health < MAX_HEALTH) {
      this.regen += dt;
      if (this.regen >= 3) {
        this.regen = 0;
        this.health = Math.min(MAX_HEALTH, this.health + 1);
        this.exhaustion += HUNGER_SECONDS * 0.15;
      }
    } else this.regen = 0;
    if (this.hunger <= 0) {
      this.starve += dt;
      if (this.starve >= 4) {
        this.starve = 0;
        damage += this.damage(1, "starve");
      }
    } else this.starve = 0;

    // Air: lasts 10 seconds under water, then drowning hurts every second.
    if (input.submerged) {
      this.air = Math.max(0, this.air - dt);
      if (this.air <= 0) {
        this.drown += dt;
        if (this.drown >= 1) {
          this.drown = 0;
          damage += this.damage(2, "drown");
        }
      }
    } else {
      this.air = Math.min(MAX_AIR, this.air + dt * 5);
      this.drown = 0;
    }
    return damage;
  }

  /** Returns the damage actually dealt. */
  damage(amount: number, cause: DamageCause): number {
    if (this.dead || amount <= 0) return 0;
    const dealt = Math.min(this.health, Math.round(amount));
    this.health -= dealt;
    this.lastCause = cause;
    return dealt;
  }

  /** Damage from landing after falling `blocks` blocks. */
  fall(blocks: number): number {
    return this.damage(Math.floor(blocks - 3), "fall");
  }

  /** Extra hunger cost for an action (jumping, mining). */
  exert(seconds: number): void {
    this.exhaustion += seconds;
  }

  eat(points: number): boolean {
    if (this.hunger >= MAX_HUNGER) return false;
    this.hunger = Math.min(MAX_HUNGER, this.hunger + points);
    return true;
  }

  heal(): void {
    this.health = MAX_HEALTH;
  }

  feed(): void {
    this.hunger = MAX_HUNGER;
  }

  reset(): void {
    this.health = MAX_HEALTH;
    this.hunger = MAX_HUNGER;
    this.air = MAX_AIR;
    this.exhaustion = this.regen = this.starve = this.drown = 0;
    this.lastCause = null;
  }

  static deathMessage(cause: DamageCause | null): string {
    switch (cause) {
      case "fall": return "You fell from a high place";
      case "drown": return "You ran out of air";
      case "starve": return "You starved";
      case "void": return "You fell out of the world";
      default: return "You died";
    }
  }
}
