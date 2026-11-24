import { CommandError } from "./types";
import { findItem, type ItemDef } from "../items/items";
import { BLOCKS, Block } from "../world/blocks";

/** A coordinate: absolute ("12", "-3.5") or relative to `base` ("~", "~5", "~-2"). */
export function coord(token: string | undefined, base: number, name: string): number {
  if (token === undefined) throw new CommandError(`Missing ${name} coordinate`);
  if (token.startsWith("~")) {
    const rest = token.slice(1);
    if (!rest) return base;
    const n = Number(rest);
    if (Number.isNaN(n)) throw new CommandError(`"${token}" isn't a valid coordinate`);
    return base + n;
  }
  const n = Number(token);
  if (Number.isNaN(n)) throw new CommandError(`"${token}" isn't a valid coordinate`);
  return n;
}

export function int(token: string | undefined, name: string, min = -Infinity, max = Infinity): number {
  if (token === undefined) throw new CommandError(`Missing ${name}`);
  const n = Number(token);
  if (!Number.isInteger(n)) throw new CommandError(`${name} must be a whole number`);
  if (n < min || n > max) throw new CommandError(`${name} must be between ${min} and ${max}`);
  return n;
}

export function bool(token: string | undefined, name: string): boolean {
  const t = token?.toLowerCase();
  if (t === "true" || t === "on" || t === "1" || t === "yes") return true;
  if (t === "false" || t === "off" || t === "0" || t === "no") return false;
  throw new CommandError(`${name} must be true or false`);
}

export function item(token: string | undefined): ItemDef {
  if (!token) throw new CommandError("Missing item name");
  const def = findItem(token);
  if (!def) throw new CommandError(`Unknown item "${token}"`);
  return def;
}

/** A block by name, including "air". */
export function block(token: string | undefined): number {
  if (!token) throw new CommandError("Missing block name");
  if (token.toLowerCase() === "air") return Block.Air;
  const def = findItem(token);
  if (def?.block === undefined || !BLOCKS[def.block]) throw new CommandError(`Unknown block "${token}"`);
  return def.block;
}

export const matching = (options: readonly string[], partial: string): string[] =>
  options.filter(o => o.startsWith(partial.toLowerCase()));
