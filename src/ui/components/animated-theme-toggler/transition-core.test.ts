/**
 * Transition geometry tests keep the theme reveal anchored to the clicked control and expressed
 * as percentages. Percentage coordinates avoid Chromium's fractional-display-scale offset bug.
 */
import { describe, expect, test } from "bun:test";
import { circleTransitionClipPaths, transitionOrigin } from "./transition-core";

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
