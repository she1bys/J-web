/**
 * Stop the page from zooming on phones. The viewport meta tag handles most browsers;
 * iPhone Safari ignores it, so pinch gestures are cancelled here too.
 */
export function blockZoomGestures(): void {
  const stop = (e: Event) => e.preventDefault();
  // Safari's pinch gesture events
  document.addEventListener("gesturestart", stop, { passive: false });
  document.addEventListener("gesturechange", stop, { passive: false });
  // Two-finger moves (pinch) everywhere else
  document.addEventListener(
    "touchmove",
    e => {
      if (e.touches.length > 1) e.preventDefault();
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
