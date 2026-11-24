/**
 * The command line: a log of messages and an input with suggestions and history.
 * Opened with T or / on a keyboard, or the CMD button on touch.
 */
export class CommandBar {
  private root: HTMLElement;
  private logEl: HTMLElement;
  private form: HTMLFormElement;
  private input: HTMLInputElement;
  private suggestEl: HTMLElement;
  private history: string[] = [];
  private historyAt = -1;
  private suggestions: string[] = [];
  isOpen = false;

  constructor(
    parent: HTMLElement,
    private run: (line: string) => void,
    private complete: (line: string) => string[],
    private onClose: () => void,
  ) {
    this.root = document.createElement("div");
    this.root.className = "cmd";
    this.root.innerHTML = `
      <div class="cmd-log" aria-live="polite"></div>
      <div class="cmd-suggest" hidden></div>
      <form class="cmd-form" hidden>
        <input class="cmd-input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send" aria-label="Command">
        <button class="cmd-send" type="submit">Go</button>
        <button class="cmd-close" type="button" aria-label="Close">X</button>
      </form>`;
    parent.appendChild(this.root);
    this.logEl = this.root.querySelector(".cmd-log")!;
    this.form = this.root.querySelector(".cmd-form")!;
    this.input = this.root.querySelector(".cmd-input")!;
    this.suggestEl = this.root.querySelector(".cmd-suggest")!;

    this.form.addEventListener("submit", e => {
      e.preventDefault();
      this.submit();
    });
    this.root.querySelector(".cmd-close")!.addEventListener("click", () => this.close());
    this.input.addEventListener("input", () => this.refreshSuggestions());
    this.input.addEventListener("keydown", e => this.onKey(e));
    // Keep keys typed here away from the game controls
    this.input.addEventListener("keyup", e => e.stopPropagation());
  }

  open(prefill = ""): void {
    this.isOpen = true;
    this.form.hidden = false;
    this.root.classList.add("open");
    this.input.value = prefill;
    this.historyAt = -1;
    this.refreshSuggestions();
    // Focus after this event finishes, so the opening key isn't typed into the box
    setTimeout(() => this.input.focus({ preventScroll: true }), 0);
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.form.hidden = true;
    this.suggestEl.hidden = true;
    this.root.classList.remove("open");
    this.input.blur();
    this.onClose();
  }

  /** Show a line in the log. */
  log(text: string, kind: "info" | "ok" | "error" = "info"): void {
    const line = document.createElement("div");
    line.className = `cmd-line ${kind}`;
    line.textContent = text;
    this.logEl.appendChild(line);
    while (this.logEl.children.length > 30) this.logEl.firstChild?.remove();
    // Lines fade out after a while unless the bar is open
    setTimeout(() => line.classList.add("old"), 9000);
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  private submit(): void {
    const line = this.input.value.trim();
    if (!line) {
      this.close();
      return;
    }
    if (this.history[this.history.length - 1] !== line) this.history.push(line);
    this.input.value = "";
    this.refreshSuggestions();
    this.run(line);
  }

  private onKey(e: KeyboardEvent): void {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      this.close();
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (this.suggestions[0]) this.use(this.suggestions[0]);
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      if (!this.history.length) return;
      if (e.key === "ArrowUp") this.historyAt = this.historyAt < 0 ? this.history.length - 1 : Math.max(0, this.historyAt - 1);
      else this.historyAt = this.historyAt < 0 ? -1 : this.historyAt + 1;
      if (this.historyAt >= this.history.length) this.historyAt = -1;
      this.input.value = this.historyAt < 0 ? "" : this.history[this.historyAt];
      this.refreshSuggestions();
    }
  }

  private use(s: string): void {
    this.input.value = `${s} `;
    this.input.focus({ preventScroll: true });
    this.refreshSuggestions();
  }

  private refreshSuggestions(): void {
    const v = this.input.value;
    this.suggestions = v.startsWith("/") || v === "" ? this.complete(v || "/") : [];
    this.suggestEl.replaceChildren();
    for (const s of this.suggestions) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = s;
      b.addEventListener("pointerdown", e => {
        e.preventDefault();
        this.use(s);
      });
      this.suggestEl.appendChild(b);
    }
    this.suggestEl.hidden = !this.isOpen || !this.suggestions.length;
  }

  dispose(): void {
    this.root.remove();
  }
}
