/**
 * Renders one menu screen (title, text, buttons) into a host element and handles
 * keyboard navigation. Screens are plain data, so menus are easy to add or reorder.
 */
export type MenuItem =
  | { kind: "title"; text: string }
  | { kind: "text"; text: string }
  | { kind: "button"; label: string; detail?: string; onSelect: () => void; onAdjust?: (dir: 1 | -1) => void }
  | { kind: "input"; label: string; value: string; placeholder?: string; maxLength?: number; onInput: (v: string) => void };

export const title = (text: string): MenuItem => ({ kind: "title", text });
export const text = (t: string): MenuItem => ({ kind: "text", text: t });
export const button = (
  label: string,
  onSelect: () => void,
  extra: { detail?: string; onAdjust?: (dir: 1 | -1) => void } = {},
): MenuItem => ({ kind: "button", label, onSelect, ...extra });

export const input = (
  label: string,
  value: string,
  onInput: (v: string) => void,
  extra: { placeholder?: string; maxLength?: number } = {},
): MenuItem => ({ kind: "input", label, value, onInput, ...extra });

export class Menu {
  private adjusters = new WeakMap<HTMLButtonElement, (dir: 1 | -1) => void>();

  constructor(
    private host: HTMLElement,
    private onClick: () => void = () => {},
  ) {}

  render(items: MenuItem[], { animate = false, focus = -1 } = {}): void {
    this.host.innerHTML = "";
    items.forEach((item, n) => {
      let node: HTMLElement;
      if (item.kind === "title") {
        node = document.createElement("h2");
        node.className = "menu-title";
        node.textContent = item.text;
      } else if (item.kind === "input") {
        node = document.createElement("label");
        node.className = "field";
        const l = document.createElement("span");
        l.className = "field-label";
        l.textContent = item.label;
        const f = document.createElement("input");
        f.type = "text";
        f.value = item.value;
        f.placeholder = item.placeholder ?? "";
        f.maxLength = item.maxLength ?? 32;
        f.autocomplete = "off";
        f.spellcheck = false;
        f.addEventListener("input", () => item.onInput(f.value));
        f.addEventListener("keydown", e => e.stopPropagation());
        node.append(l, f);
      } else if (item.kind === "text") {
        node = document.createElement("p");
        node.className = "menu-text";
        // Text items are written in code, never from user input.
        node.innerHTML = item.text;
      } else {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn";
        b.innerHTML = `<span class="btn-label"></span>${item.detail ? '<span class="btn-detail"></span>' : ""}`;
        b.querySelector(".btn-label")!.textContent = item.label;
        if (item.detail) b.querySelector(".btn-detail")!.textContent = item.detail;
        b.addEventListener("click", e => {
          e.stopPropagation();
          this.onClick();
          item.onSelect();
        });
        if (item.onAdjust) this.adjusters.set(b, item.onAdjust);
        node = b;
      }
      if (animate) {
        node.classList.add("pop");
        node.style.animationDelay = `${n * 60}ms`;
      }
      this.host.appendChild(node);
    });
    if (focus >= 0) this.buttons()[focus]?.focus({ preventScroll: true });
  }

  buttons(): HTMLButtonElement[] {
    return [...this.host.querySelectorAll<HTMLButtonElement>("button.btn")];
  }

  focusedIndex(): number {
    return this.buttons().indexOf(document.activeElement as HTMLButtonElement);
  }

  /** Arrow keys move between options; left/right adjust a value. Returns true if handled. */
  handleKey(e: KeyboardEvent): boolean {
    const btns = this.buttons();
    if (!btns.length) return false;
    const at = this.focusedIndex();
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const d = e.key === "ArrowDown" ? 1 : -1;
      btns[(at + d + btns.length) % btns.length]?.focus();
      return true;
    }
    if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && at >= 0) {
      const adjust = this.adjusters.get(btns[at]);
      if (adjust) {
        this.onClick();
        adjust(e.key === "ArrowRight" ? 1 : -1);
        return true;
      }
    }
    return false;
  }
}
