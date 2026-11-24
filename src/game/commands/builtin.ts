import { ITEMS } from "../items/items";
import { MODE_NAMES, parseMode } from "../modes";
import { CommandError, type Command, type CommandContext } from "./types";
import { CommandRegistry } from "./registry";
import { block, bool, coord, int, item, matching } from "./args";

const ITEM_NAMES = ITEMS.map(i => i.key);
const BLOCK_NAMES = ["air", ...ITEMS.filter(i => i.block !== undefined).map(i => i.key)];
const MAX_FILL = 32768;

/** Hours on a 24-hour clock <-> time of day (0 = sunrise at 6:00). */
export const hoursToTime = (h: number): number => ((((h - 6) / 24) % 1) + 1) % 1;
export const timeToHours = (t: number): number => (t * 24 + 6) % 24;
const clock = (t: number) => {
  const h = timeToHours(t);
  return `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.floor((h % 1) * 60)).padStart(2, "0")}`;
};
const NAMED_TIMES: Record<string, number> = { sunrise: 6, day: 8, noon: 12, sunset: 18, night: 21, midnight: 0 };

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Complete x y z arguments with "~" (and the player's block position as a hint). */
const completeCoords = (index: number, ctx: CommandContext, offset = 0): string[] => {
  const i = index - offset;
  if (i < 0 || i > 2) return [];
  const p = ctx.position;
  return ["~", String(Math.floor([p.x, p.y, p.z][i]))];
};

const help: (reg: CommandRegistry) => Command = reg => ({
  name: "help",
  aliases: ["?"],
  usage: "/help [command]",
  description: "List commands, or explain one",
  run(args) {
    if (args[0]) {
      const c = reg.find(args[0].replace(/^\//, ""));
      if (!c) throw new CommandError(`No command "${args[0]}"`);
      return `${c.usage}: ${c.description}`;
    }
    return reg.list().map(c => `/${c.name}`).join("  ");
  },
  complete: (i, args) => (i === 0 ? matching(reg.list().map(c => c.name), args[0]) : []),
});

const gamemode: Command = {
  name: "gamemode",
  aliases: ["gm"],
  usage: "/gamemode <survival|creative>",
  description: "Switch between survival and creative",
  run(args, ctx) {
    const m = parseMode(args[0] ?? "");
    if (!m) throw new CommandError("Choose survival or creative");
    ctx.setMode(m);
    return `Game mode set to ${MODE_NAMES[m]}`;
  },
  complete: (i, args) => (i === 0 ? matching(["survival", "creative"], args[0]) : []),
};

const tp: Command = {
  name: "tp",
  aliases: ["teleport"],
  usage: "/tp <x> <y> <z>",
  description: "Teleport (use ~ for relative, e.g. /tp ~ ~10 ~)",
  run(args, ctx) {
    const p = ctx.position;
    const x = coord(args[0], p.x, "x");
    const y = coord(args[1], p.y, "y");
    const z = coord(args[2], p.z, "z");
    ctx.teleport(x, y, z);
    return `Teleported to ${fmt(x)} ${fmt(y)} ${fmt(z)}`;
  },
  complete: (i, _a, ctx) => completeCoords(i, ctx),
};

const give: Command = {
  name: "give",
  usage: "/give <item> [count]",
  description: "Get items, e.g. /give stone_pickaxe or /give planks 64",
  run(args, ctx) {
    const def = item(args[0]);
    const count = args[1] === undefined ? 1 : int(args[1], "count", 1, 2304);
    const given = ctx.give(def.id, count);
    if (!given) throw new CommandError("Your inventory is full");
    return `Gave ${given} ${def.name}${given < count ? " (inventory full)" : ""}`;
  },
  complete: (i, args) => (i === 0 ? matching(ITEM_NAMES, args[0]) : i === 1 ? ["1", "16", "64"] : []),
};

const clear: Command = {
  name: "clear",
  usage: "/clear",
  description: "Empty your inventory",
  run(_a, ctx) {
    return `Removed ${ctx.clearInventory()} items`;
  },
};

const time: Command = {
  name: "time",
  usage: "/time <set|add|query> [sunrise|day|noon|sunset|night|midnight|hours]",
  description: "Change the time of day (24-hour clock)",
  run(args, ctx) {
    const sub = args[0]?.toLowerCase();
    if (sub === "query" || !sub) return `It's ${clock(ctx.time)}`;
    const v = args[1]?.toLowerCase();
    if (sub === "set") {
      const h = v && v in NAMED_TIMES ? NAMED_TIMES[v] : Number(v);
      if (v === undefined || Number.isNaN(h)) throw new CommandError("Give a time like noon or 14");
      ctx.setTime(hoursToTime(h));
      return `Time set to ${clock(ctx.time)}`;
    }
    if (sub === "add") {
      const h = Number(v);
      if (Number.isNaN(h)) throw new CommandError("Give a number of hours");
      ctx.setTime((ctx.time + h / 24 + 1) % 1);
      return `Time is now ${clock(ctx.time)}`;
    }
    throw new CommandError(`Unknown option "${sub}"`);
  },
  complete: (i, args) =>
    i === 0 ? matching(["set", "add", "query"], args[0]) : i === 1 && args[0] === "set" ? matching(Object.keys(NAMED_TIMES), args[1]) : [],
};

const gamerule: Command = {
  name: "gamerule",
  usage: "/gamerule <keepInventory|dayCycle> [true|false]",
  description: "World rules: keep items when you die, let time pass",
  run(args, ctx) {
    const keys = Object.keys(ctx.rules) as (keyof typeof ctx.rules)[];
    const key = keys.find(k => k.toLowerCase() === args[0]?.toLowerCase());
    if (!key) return keys.map(k => `${k} = ${ctx.rules[k]}`).join("  ");
    if (args[1] === undefined) return `${key} = ${ctx.rules[key]}`;
    const v = bool(args[1], key);
    ctx.setRule(key, v);
    return `${key} set to ${v}`;
  },
  complete: (i, args, ctx) => (i === 0 ? Object.keys(ctx.rules).filter(k => k.toLowerCase().startsWith(args[0].toLowerCase())) : i === 1 ? ["true", "false"] : []),
};

const heal: Command = { name: "heal", usage: "/heal", description: "Restore full health", run: (_a, ctx) => (ctx.heal(), "Healed") };
const feed: Command = { name: "feed", usage: "/feed", description: "Fill your hunger bar", run: (_a, ctx) => (ctx.feed(), "Fed") };
const kill: Command = { name: "kill", usage: "/kill", description: "Respawn at the spawn point", run: (_a, ctx) => (ctx.kill(), "Ouch") };

const spawn: Command = {
  name: "spawn",
  usage: "/spawn",
  description: "Go back to the spawn point",
  run(_a, ctx) {
    const s = ctx.spawn;
    ctx.teleport(s.x, s.y, s.z);
    return "Back at spawn";
  },
};

const setspawn: Command = {
  name: "setspawn",
  usage: "/setspawn [x y z]",
  description: "Set where you respawn (default: here)",
  run(args, ctx) {
    const p = ctx.position;
    const x = args.length ? coord(args[0], p.x, "x") : p.x;
    const y = args.length ? coord(args[1], p.y, "y") : p.y;
    const z = args.length ? coord(args[2], p.z, "z") : p.z;
    ctx.setSpawn(x, y, z);
    return `Spawn point set to ${Math.floor(x)} ${Math.floor(y)} ${Math.floor(z)}`;
  },
  complete: (i, _a, ctx) => completeCoords(i, ctx),
};

const fly: Command = {
  name: "fly",
  usage: "/fly",
  description: "Toggle flying (creative mode)",
  run(_a, ctx) {
    if (ctx.mode !== "creative") throw new CommandError("Flying needs creative mode (/gamemode creative)");
    return ctx.setFlying(!ctx.flying) ? "Flying on" : "Flying off";
  },
};

const setblock: Command = {
  name: "setblock",
  usage: "/setblock <x> <y> <z> <block>",
  description: "Place or remove one block",
  run(args, ctx) {
    const p = ctx.position;
    const x = Math.floor(coord(args[0], p.x, "x"));
    const y = Math.floor(coord(args[1], p.y, "y"));
    const z = Math.floor(coord(args[2], p.z, "z"));
    const id = block(args[3]);
    const n = ctx.setBlocks([[x, y, z, id]]);
    return n ? `Set block at ${x} ${y} ${z}` : "Nothing changed (outside the world or already that block)";
  },
  complete: (i, args, ctx) => (i === 3 ? matching(BLOCK_NAMES, args[3]) : completeCoords(i, ctx)),
};

const fill: Command = {
  name: "fill",
  usage: "/fill <x1> <y1> <z1> <x2> <y2> <z2> <block>",
  description: `Fill a box with a block (up to ${MAX_FILL} blocks)`,
  run(args, ctx) {
    const p = ctx.position;
    const a = [coord(args[0], p.x, "x1"), coord(args[1], p.y, "y1"), coord(args[2], p.z, "z1")].map(Math.floor);
    const b = [coord(args[3], p.x, "x2"), coord(args[4], p.y, "y2"), coord(args[5], p.z, "z2")].map(Math.floor);
    const id = block(args[6]);
    const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
    const [y0, y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
    const [z0, z1] = [Math.min(a[2], b[2]), Math.max(a[2], b[2])];
    const volume = (x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1);
    if (volume > MAX_FILL) throw new CommandError(`That's ${volume} blocks; the limit is ${MAX_FILL}`);
    const cells: [number, number, number, number][] = [];
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) cells.push([x, y, z, id]);
    return `Filled ${ctx.setBlocks(cells)} blocks`;
  },
  complete: (i, args, ctx) => (i === 6 ? matching(BLOCK_NAMES, args[6]) : completeCoords(i % 3, ctx)),
};

const pos: Command = {
  name: "pos",
  aliases: ["where", "coords"],
  usage: "/pos",
  description: "Show where you are",
  run(_a, ctx) {
    const p = ctx.position;
    const s = ctx.worldSize;
    return `You're at ${Math.floor(p.x)} ${Math.floor(p.y)} ${Math.floor(p.z)} (world is ${s.x}×${s.y}×${s.z})`;
  },
};

const seed: Command = {
  name: "seed",
  usage: "/seed",
  description: "Show this world's seed",
  run: (_a, ctx) => `Seed of "${ctx.worldName}": ${ctx.seed}`,
};

const blocks: Command = {
  name: "items",
  aliases: ["blocks"],
  usage: "/items",
  description: "List every item name for /give",
  run: () => ITEM_NAMES.join("  "),
};

/** All built-in commands. */
export function createCommands(): CommandRegistry {
  const reg = new CommandRegistry();
  reg.register(gamemode, tp, give, clear, time, gamerule, heal, feed, kill, spawn, setspawn, fly, setblock, fill, pos, seed, blocks);
  reg.register(help(reg));
  return reg;
}

