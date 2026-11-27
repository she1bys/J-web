import { defineConfig, type Plugin } from "vite";
import { createHash } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Generates `sw.js`, the service worker that lets the game run offline: it lists every built
 * file plus everything in public/, so they're stored on the device on first visit. The cache
 * name includes a hash of the file list, so each deploy replaces the old copy.
 */
function serviceWorker(): Plugin {
  const publicFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap(name => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? publicFiles(full) : [relative("public", full).split(sep).join("/")];
    });

  return {
    name: "gracia-service-worker",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const files = [...Object.keys(bundle), ...publicFiles("public")]
        .filter(f => f !== "sw.js" && !f.endsWith(".map"))
        .map(f => `./${f}`);
      const precache = ["./", ...new Set(files)].sort();
      const version = createHash("sha256").update(precache.join("\n")).digest("hex").slice(0, 12);
      this.emitFile({ type: "asset", fileName: "sw.js", source: swSource(version, precache) });
    },
  };
}

const swSource = (version: string, precache: string[]) => `// Generated at build time. Keeps Gracia playable offline.
const CACHE = "gracia-${version}";
const PRECACHE = ${JSON.stringify(precache, null, 2)};

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(PRECACHE.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("gracia-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    // Pages: try the network first so updates arrive; fall back to the saved copy offline.
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put("./", copy));
          return res;
        })
        .catch(() => caches.match("./", { ignoreVary: true })),
    );
    return;
  }
  // Files (scripts, styles, icons, songs): use the saved copy, fetch and save anything new.
  event.respondWith(
    // ignoreVary: the saved copy was fetched with different headers than a module import sends.
    caches.match(req, { ignoreVary: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    })),
  );
});
`;

export default defineConfig({
  // Relative asset paths, so the build works at a domain root or in a sub-folder (e.g. GitHub Pages).
  base: "./",
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 900,
  },
  plugins: [serviceWorker()],
});
