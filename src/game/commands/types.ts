import type { GameMode } from "../modes";
import type { WorldRules } from "../world/WorldStore";

export interface Vec3 { x: number; y: number; z: number }

/**
 * Everything a command is allowed to do to the game. Commands only talk to this
 * interface, never to the Game class directly, so the same commands can later run
 * on a multiplayer server against a different implementation.
 */
export interface CommandContext {
  readonly mode: GameMode;
  setMode(mode: GameMode): void;

  readonly position: Vec3;
  teleport(x: number, y: number, z: number): void;
  readonly spawn: Vec3;
  setSpawn(x: number, y: number, z: number): void;

  /** Gives as many as fit; returns how many were given. */
  give(itemId: number, count: number): number;
  clearInventory(): number;

  /** Time of day, 0–1 (0 sunrise, 0.25 noon, 0.5 sunset, 0.75 midnight). */
  readonly time: number;
  setTime(t: number): void;

  readonly rules: WorldRules;
  setRule<K extends keyof WorldRules>(key: K, value: WorldRules[K]): void;

  heal(): void;
  feed(): void;
  kill(): void;
  readonly flying: boolean;
  setFlying(on: boolean): boolean;

  readonly worldSize: Vec3;
  getBlock(x: number, y: number, z: number): number;
  /** Set many blocks at once; returns how many changed. */
  setBlocks(blocks: Iterable<[x: number, y: number, z: number, id: number]>): number;

  readonly seed: number;
  readonly worldName: string;
}

/** Thrown for bad input; the message is shown to the player in red. */
export class CommandError extends Error {}

export interface Command {
  name: string;
  aliases?: string[];
  /** e.g. "/give <item> [count]" */
  usage: string;
  description: string;
  run(args: string[], ctx: CommandContext): string | void;
  /** Suggestions for the argument at `index`, given what's typed so far. */
  complete?(index: number, args: string[], ctx: CommandContext): string[];
}
