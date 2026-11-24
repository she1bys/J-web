import { CommandError, type Command, type CommandContext } from "./types";

export interface CommandResult {
  ok: boolean;
  message: string;
}

/** Holds commands, runs typed lines, and suggests completions. */
export class CommandRegistry {
  private commands = new Map<string, Command>();
  private names = new Map<string, Command>();

  register(...cmds: Command[]): this {
    for (const c of cmds) {
      this.commands.set(c.name, c);
      for (const n of [c.name, ...(c.aliases ?? [])]) this.names.set(n, c);
    }
    return this;
  }

  list(): Command[] {
    return [...this.commands.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  find(name: string): Command | undefined {
    return this.names.get(name.toLowerCase());
  }

  execute(line: string, ctx: CommandContext): CommandResult {
    const text = line.trim().replace(/^\//, "");
    if (!text) return { ok: false, message: "Type a command, e.g. /help" };
    const [name, ...args] = text.split(/\s+/);
    const cmd = this.find(name);
    if (!cmd) return { ok: false, message: `Unknown command "/${name}". Try /help` };
    try {
      return { ok: true, message: cmd.run(args, ctx) ?? "Done" };
    } catch (e) {
      if (e instanceof CommandError) return { ok: false, message: `${e.message}. Usage: ${cmd.usage}` };
      return { ok: false, message: "Something went wrong running that command" };
    }
  }

  /** Full-line suggestions for what's typed so far. */
  complete(line: string, ctx: CommandContext): string[] {
    const text = line.replace(/^\//, "");
    const parts = text.split(/\s+/);
    if (parts.length <= 1) {
      const p = parts[0].toLowerCase();
      return this.list().filter(c => c.name.startsWith(p)).map(c => `/${c.name}`).slice(0, 8);
    }
    const cmd = this.find(parts[0]);
    if (!cmd?.complete) return [];
    const args = parts.slice(1);
    const head = `/${parts.slice(0, -1).join(" ")} `;
    return cmd.complete(args.length - 1, args, ctx).slice(0, 8).map(s => head + s);
  }
}
