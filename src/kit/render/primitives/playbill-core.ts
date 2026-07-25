/**
 * Pure responsive and animation math for the persistent theatre marquee.
 */

/** Small panes keep a one-line masthead so chrome never crowds out the conversation. */
export const compactPlaybill = (width: number, height: number): boolean =>
  width < 60 || height < 16;

/** Which half-width lamp cells are bright for one twinkle frame. */
export const lampPattern = (
  width: number,
  tick: number,
  phase: number,
): readonly boolean[] => {
  const dots = Math.max(0, Math.ceil(width / 2));
  return Array.from(
    { length: dots },
    (_, index) => (index * 5 + tick + phase) % 11 === 0,
  );
};
