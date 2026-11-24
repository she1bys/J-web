/**
 * Project-wide identity. Change `title` to rename the game everywhere:
 * title screen, intro movie, the sign in the sky and the hidden letters.
 */
export const GAME = {
  title: "JOANA",
  /** The word whose letters are hidden in every map. */
  collectWord: "JOANA",
  credits: ["Made with love", "for Joana"],
  /** Prefix for everything saved in the browser. */
  storagePrefix: "joana",
} as const;
