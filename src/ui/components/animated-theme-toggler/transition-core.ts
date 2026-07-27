/**
 * Pure geometry for the animated theme reveal. View-transition clip paths use percentages because
 * Chromium can offset pixel coordinates on the first transition at fractional display scaling.
 */
/** What the toggler needs to know about its host before it risks a View Transition. */
export interface TransitionHost {
  /** True when the engine exposes document.startViewTransition at all. */
  supported: boolean;
  /** True when the user asked for less motion. */
  reduceMotion: boolean;
  /** navigator.userAgent, used only to identify the embedded WebView2 host. */
  userAgent: string;
}

/**
 * How to animate a theme change on this host.
 *
 *   view-transition  the document-wide cross-fade; the richest version
 *   overlay          the same circular sweep drawn with an ordinary element
 *   none             switch instantly, for reduced motion
 *
 * WHY WEBVIEW2 GETS THE OVERLAY. Hoplight.exe is a WebView2 window, and repeated theme toggles there
 * crashed the renderer with STATUS_BREAKPOINT, taking the whole page down. View Transitions snapshot
 * and cross-fade the entire document through the compositor, and that crash signature is a renderer
 * or GPU fault, which no JavaScript can catch: the page is simply gone.
 *
 * The answer is a different implementation, not a missing animation. The overlay sweep is one div
 * and a clip-path, so the engine has no document snapshot to build and tear down, and the reveal
 * still grows from the control exactly as before.
 *
 * Stated honestly: the crash could not be reproduced in headless Chromium, which skips the GPU
 * compositing path the signature points at. Browsers keep the richer version because there is no
 * evidence against it there, and the embedded host gets the version that cannot take the window
 * down. Revisit if WebView2 fixes it; the test names exactly what to undo.
 */
export type ThemeRevealStrategy = "view-transition" | "overlay" | "none";

export function themeRevealStrategy(host: TransitionHost): ThemeRevealStrategy {
  if (host.reduceMotion) return "none";
  if (isEmbeddedWebView(host.userAgent)) return "overlay";
  return host.supported ? "view-transition" : "overlay";
}

/** WebView2 and Edge report "Edg/"; no other Chromium host does. */
export function isEmbeddedWebView(userAgent: string): boolean {
  return /\bEdg\//.test(userAgent);
}

export interface ButtonBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface TransitionPoint {
  x: number;
  y: number;
}

function percent(value: number, whole: number): string {
  return `${Number(((value / Math.max(whole, 1)) * 100).toFixed(4))}%`;
}

export function transitionOrigin(
  button: ButtonBounds,
  viewport: ViewportSize,
  fromCenter: boolean,
): TransitionPoint {
  if (fromCenter) return { x: viewport.width / 2, y: viewport.height / 2 };
  return {
    x: button.left + button.width / 2,
    y: button.top + button.height / 2,
  };
}

export function circleTransitionClipPaths(
  origin: TransitionPoint,
  viewport: ViewportSize,
): [string, string] {
  const point = `${percent(origin.x, viewport.width)} ${percent(origin.y, viewport.height)}`;
  const maxRadius = Math.hypot(
    Math.max(origin.x, viewport.width - origin.x),
    Math.max(origin.y, viewport.height - origin.y),
  );
  const referenceRadius = Math.hypot(viewport.width, viewport.height) / Math.SQRT2;
  return [
    `circle(0% at ${point})`,
    `circle(${percent(maxRadius, referenceRadius)} at ${point})`,
  ];
}
