/**
 * Pure geometry for the animated theme reveal. View-transition clip paths use percentages because
 * Chromium can offset pixel coordinates on the first transition at fractional display scaling.
 */
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
