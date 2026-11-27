/** Register the service worker (production builds only), so the game works offline. */
export function enableOffline(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* offline support is a bonus; the game works without it */
    });
  });
}

/**
 * Ask the browser to keep this site's data (saved worlds) even when space is low.
 * Browsers grant it more readily once the site is installed or used often. Call from a tap.
 */
export function requestPersistentStorage(): void {
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* not supported */
  }
}
