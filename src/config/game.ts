/**
 * Project-wide identity. `title` is shown only on the main menu (title screen).
 */
export const GAME = {
  title: "GRACIA",
  credits: ["3D engine: three.js", "Pixel font: Silkscreen", "by Jason Kottke"],
  /**
   * Prefix for everything saved in the browser. Kept from the first version of the game:
   * changing it would make existing saved worlds and settings disappear.
   */
  storagePrefix: "joana",
} as const;
