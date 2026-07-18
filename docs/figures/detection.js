// ─────────────────────────────────────────────────────────────
// detection.js: figure data for docs/reference/concepts/detection.md,
// keyed by page slug then figure id. Prose lives in the .md and drops
// a figure in with `@fig <id>`; this file is the data behind that id.
// Shape (funnel) mirrors the portfolio figure spec. Grounded in
// src/core/registry.ts.
// ─────────────────────────────────────────────────────────────

export const figures = {
  detection: {
    pass: {
      type: 'funnel', fig: 'fig·01', title: 'one registry pass, many adapters, one winner',
      caption:
        'Illustrative, not measured: registry.detect() scores every registered adapter against the same input, discards the ones that return 0 (most of them, since a detector returns 0 on another entity kind), keeps only scores that clear the 0.5 threshold, then returns the single highest, or undefined when none clear (src/core/registry.ts:30-41). The final drop from two survivors to one is the specific-outranks-generic gradient: on a plain CCv3 card, sillytavern (0.9) survives and rolecall (0) does not, but on a card carrying an extensions.rolecall block both clear and rolecall (1.0) wins. Counts show the shape; the real registry holds every adapter the loader found.',
      steps: [
        { label: 'every adapter', value: 20, color: 'teal' },
        { label: 'returned above 0', value: 3, color: 'sage' },
        { label: 'cleared 0.5', value: 2, color: 'ochre' },
        { label: 'single highest', value: 1, color: 'plum' },
      ],
    },
  },
};
