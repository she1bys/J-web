import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths, so the build works at a domain root or in a sub-folder (e.g. GitHub Pages).
  base: "./",
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 900,
  },
});
