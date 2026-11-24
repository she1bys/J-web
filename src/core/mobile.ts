/**
 * Stop the page from zooming on phones. The viewport meta tag handles most browsers;
 * iPhone Safari ignores it, so pinch gestures are cancelled here too.
 */
export function blockZoomGestures(): void {
  const stop = (e: Event) => e.preventDefault();
  // Safari's pinch gesture events
  document.addEventListener("gesturestart", stop, { passive: false });
  document.addEventListener("gesturechange", stop, { passive: false });
  // Two-finger moves (pinch) everywhere, and any swipe on the game itself, so Safari doesn't
  // scroll, bounce or pop its toolbar up. Lists that scroll (recipes, items, menus) still can.
  document.addEventListener(
    "touchmove",
    e => {
      const t = e.target as HTMLElement;
      const scrollable = t.closest?.(".menu, .inv-recipes, .inv-palette, .cmd-log, .cmd-suggest, .inv-body");
      if (e.touches.length > 1 || (t.closest?.(".play-layer") && !scrollable)) e.preventDefault();
    },
    { passive: false },
  );
  // Double-tap zoom is turned off with `touch-action: manipulation` in base.css. (Cancelling
  // quick second taps in script would also swallow fast taps on buttons, so we don't.)
  // Long-press menus and Ctrl+wheel zoom on desktop
  document.addEventListener("contextmenu", e => {
    if ((e.target as HTMLElement).closest(".play-layer")) e.preventDefault();
  });
  addEventListener(
    "wheel",
    e => {
      if (e.ctrlKey) e.preventDefault();
    },
    { passive: false },
  );
}
