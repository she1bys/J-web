/** Shared input state written by the keyboard/mouse and touch controls, read by the game each frame. */
export interface InputState {
  moveX: number;
  moveZ: number;
  jump: boolean;
  sprint: boolean;
  descend: boolean;
  /** Held down to mine the block under the crosshair. */
  mining: boolean;
  /** Look movement accumulated since the last frame, in screen pixels. */
  lookX: number;
  lookY: number;
}

export interface InputActions {
  /** Place the held block, or eat the held food. */
  use(): void;
  openInventory(): void;
  /** Open the command line, optionally starting with some text (e.g. "/"). */
  openCommands(prefill: string): void;
  /** Throw the held item (one, or the whole stack). */
  dropItem(all: boolean): void;
  toggleCamera(): void;
  toggleFly(): void;
  selectSlot(n: number): void;
  cycleSlot(dir: number): void;
  pause(): void;
}

export const emptyInput = (): InputState => ({
  moveX: 0, moveZ: 0, jump: false, sprint: false, descend: false, mining: false, lookX: 0, lookY: 0,
});
