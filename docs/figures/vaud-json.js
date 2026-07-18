// ─────────────────────────────────────────────────────────────
// vaud-json.js: figure data for docs/reference/formats/vaud-json.md,
// keyed by page slug then figure id. Prose lives in the .md and drops
// a figure in with `@fig <id>`; this file is the data behind that id.
// Shapes (flow / matrix) mirror the portfolio figure spec. Every
// figure is grounded in src/formats/vaud-json/index.ts and
// src/core/registry.ts.
// ─────────────────────────────────────────────────────────────

export default {
  'vaud-json': {
    detect: {
      type: 'flow', fig: 'fig·01', title: 'the detect() to registry path',
      caption:
        'detect() scores 1.0 / 0.1 / 0 (index.ts:28-36), but registry.detect() only ever returns the highest score, and only when it clears DETECT_THRESHOLD 0.5 (registry.ts:10,30-41). 0.1 never clears 0.5, so that branch cannot currently win a file through the registry.',
      steps: [
        { label: 'Canonical wrapper', sub: 'kind + schemaVersion match', color: 'sage' },
        { label: 'Score 1.0', sub: 'always wins detection', color: 'teal' },
        { label: 'Other JSON', sub: 'score 0.1, below threshold', color: 'ochre' },
        { label: 'registry.detect()', sub: 'gate at >= 0.5', color: 'plum' },
      ],
    },
  },
};
