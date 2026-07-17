/**
 * Desk layout doctrine (RC-grade density) for workbench editors.
 *
 * Geometry rules - apply to lore, character, pack, and future desks:
 * 1. Header chrome: identity left · compact dials right (mode, order, scan, tokens, close).
 * 2. Progressive disclosure: mode tabs (Simple/Advanced), menus (+ Condition), not permanent walls.
 * 3. Instrument strips: one horizontal row per cluster (position, timing, recursion, group).
 * 4. Content owns the canvas; long-tail controls live below the fold.
 * 5. Off-target platform lens HIDES instruments; never deletes body data.
 * 6. Home host (Vaude full card) can show the richest strip; lean hosts strip down.
 *
 * Presentation only - codecs and canonical schema stay the source of truth.
 */
export const DESK_DOCTRINE = "rc-dense-progressive" as const;
