/**
 * Transition geometry tests keep the theme reveal anchored to the clicked control and expressed
 * as percentages. Percentage coordinates avoid Chromium's fractional-display-scale offset bug.
 */
import { describe, expect, test } from "bun:test";
import {
  circleTransitionClipPaths,
  isEmbeddedWebView,
  themeRevealStrategy,
  transitionOrigin,
} from "./transition-core";

describe("animated theme transition geometry", () => {
  test("anchors the reveal to the center of the clicked button", () => {
    expect(
      transitionOrigin(
        { left: 880, top: 80, width: 40, height: 40 },
        { width: 1000, height: 800 },
        false,
      ),
    ).toEqual({ x: 900, y: 100 });
  });

  test("can expand from the viewport center", () => {
    expect(
      transitionOrigin(
        { left: 880, top: 80, width: 40, height: 40 },
        { width: 1000, height: 800 },
        true,
      ),
    ).toEqual({ x: 500, y: 400 });
  });

  test("builds scale-safe percentage clip paths that cover the farthest corner", () => {
    const [collapsed, expanded] = circleTransitionClipPaths(
      { x: 900, y: 100 },
      { width: 1000, height: 800 },
    );

    expect(collapsed).toBe("circle(0% at 90% 12.5%)");
    expect(expanded).toStartWith("circle(125.91");
    expect(expanded).toEndWith(" at 90% 12.5%)");
    expect(expanded).not.toContain("px");
  });
});

describe("themeRevealStrategy", () => {
  const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/150.0.0.0 Safari/537.36";
  const WEBVIEW2 = `${CHROME} Edg/150.0.4078.99`;
  const host = (over: Partial<Parameters<typeof themeRevealStrategy>[0]> = {}) =>
    ({ supported: true, reduceMotion: false, userAgent: CHROME, ...over });

  test("a capable browser gets the richest reveal", () => {
    expect(themeRevealStrategy(host())).toBe("view-transition");
  });

  test("an engine without the API still animates, via the overlay", () => {
    expect(themeRevealStrategy(host({ supported: false }))).toBe("overlay");
  });

  test("reduced motion is the only case that skips the animation entirely", () => {
    expect(themeRevealStrategy(host({ reduceMotion: true }))).toBe("none");
    expect(themeRevealStrategy(host({ reduceMotion: true, userAgent: WEBVIEW2 }))).toBe("none");
  });

  // Repeated toggles crashed the WebView2 renderer with STATUS_BREAKPOINT, which takes the whole
  // page down and cannot be caught. Delete this case only once that host is known to be fixed.
  // Repeated View Transitions crashed the WebView2 renderer with STATUS_BREAKPOINT, which takes the
  // whole page down and cannot be caught. It still gets the sweep, drawn a way that cannot crash it.
  test("the embedded host keeps an animation, just not the compositor one", () => {
    expect(themeRevealStrategy(host({ userAgent: WEBVIEW2 }))).toBe("overlay");
  });

  test("the marker is not matched loosely", () => {
    expect(isEmbeddedWebView("Mozilla/5.0 Chrome/150 Safari/537.36")).toBe(false);
    expect(isEmbeddedWebView("Mozilla/5.0 EdgA/120.0.0.0")).toBe(false);
    expect(isEmbeddedWebView("Mozilla/5.0 Chrome/150 Edg/150.0.0.0")).toBe(true);
  });
});
