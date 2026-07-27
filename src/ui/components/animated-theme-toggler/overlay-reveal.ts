/**
 * The theme reveal, done with an ordinary element instead of the View Transitions API.
 *
 * WHY A SECOND IMPLEMENTATION EXISTS. startViewTransition snapshots and cross-fades the whole
 * document through the compositor, and repeated toggles in the embedded WebView2 host crashed the
 * renderer outright (STATUS_BREAKPOINT), taking the page with it. This does the same circular sweep
 * with one absolutely positioned div and a clip-path animation: no document snapshot, no compositor
 * transition, nothing the engine has to tear down and rebuild. Plain enough that it cannot take the
 * window down with it.
 *
 * The sweep is the INCOMING theme's page colour growing from the control, and the theme is applied
 * once the circle has covered the viewport. Because the overlay is exactly the colour the page is
 * about to become, the moment of the swap is invisible: the background never jumps, only the
 * content arrives.
 *
 * Every exit path removes the overlay. A reveal that failed halfway and left a coloured sheet over
 * the studio would be far worse than no animation at all.
 */
import type { TransitionPoint } from "./transition-core";

/**
 * The page background for a theme, read from the token sheet.
 *
 * Deliberately has no fallback value. Copying the two colours here would duplicate the token sheet
 * and drift the first time a theme is retouched, and a sweep in a stale colour is worse than no
 * sweep. An empty answer means the caller should switch instantly instead.
 */
export function canvasColorFor(theme: "paper" | "stage", root: HTMLElement): string {
  const probe = document.createElement("div");
  probe.dataset.theme = theme;
  probe.style.display = "none";
  root.appendChild(probe);
  const colour = getComputedStyle(probe).getPropertyValue("--canvas").trim();
  probe.remove();
  return colour;
}

export interface OverlayRevealOptions {
  origin: TransitionPoint;
  /** [from, to] circle clip paths, already computed for this viewport. */
  clipPath: [string, string];
  incomingColour: string;
  durationMs: number;
  /** Applied once the sweep has covered the screen, so the swap is never visible. */
  commit: () => void;
}

/**
 * Run the sweep. Resolves when the overlay is gone and the theme is applied, whether the animation
 * played, was cut short, or never started at all.
 */
export async function runOverlayReveal(options: OverlayRevealOptions): Promise<void> {
  const { clipPath, incomingColour, durationMs, commit } = options;
  const sheet = document.createElement("div");
  sheet.setAttribute("aria-hidden", "true");
  sheet.style.cssText = [
    "position:fixed",
    "inset:0",
    `background:${incomingColour}`,
    "pointer-events:none",
    "z-index:2147483646",
    `clip-path:${clipPath[0]}`,
  ].join(";");

  let committed = false;
  const commitOnce = (): void => {
    if (committed) return;
    committed = true;
    commit();
  };

  document.body.appendChild(sheet);
  try {
    const animation = sheet.animate({ clipPath }, {
      duration: durationMs,
      easing: "ease-in-out",
      fill: "forwards",
    });
    await animation.finished.catch(() => undefined);
  } catch {
    // An engine without Web Animations still gets the theme; it just gets it instantly.
  } finally {
    commitOnce();
    sheet.remove();
  }
}
