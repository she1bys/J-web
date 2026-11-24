/** "You died" overlay with Respawn and Main menu. */
export class DeathScreen {
  private root: HTMLElement;
  private cause: HTMLElement;
  isOpen = false;

  constructor(parent: HTMLElement, onRespawn: () => void, onMenu: () => void) {
    this.root = document.createElement("div");
    this.root.className = "death";
    this.root.hidden = true;
    this.root.innerHTML = `
      <h2 class="death-title">You died</h2>
      <p class="death-cause"></p>
      <div class="death-actions">
        <button class="btn death-respawn" type="button">Respawn</button>
        <button class="btn death-menu" type="button">Main menu</button>
      </div>`;
    parent.appendChild(this.root);
    this.cause = this.root.querySelector(".death-cause")!;
    this.root.querySelector(".death-respawn")!.addEventListener("click", () => onRespawn());
    this.root.querySelector(".death-menu")!.addEventListener("click", () => onMenu());
  }

  show(message: string): void {
    this.cause.textContent = message;
    this.root.hidden = false;
    this.isOpen = true;
  }

  hide(): void {
    this.root.hidden = true;
    this.isOpen = false;
  }

  dispose(): void {
    this.root.remove();
  }
}
