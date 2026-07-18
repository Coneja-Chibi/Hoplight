// ─────────────────────────────────────────────────────────────
// backyard.js: figure data for docs/reference/formats/backyard.md,
// keyed by page slug then figure id. Prose lives in the .md and
// drops a figure in with `@fig <id>`; this file is the data behind
// that id. Shapes (flow / matrix) mirror the portfolio figure spec.
// Every figure is grounded in src/formats/backyard/.
// ─────────────────────────────────────────────────────────────

export default {
  backyard: {
    codecs: {
      type: 'matrix', fig: 'fig·01', title: 'two codecs, one folder',
      caption:
        'The Backyard folder default-exports two adapters (src/formats/backyard/index.ts). Neither is a Tavern superset, and neither shares a wire shape with the other: one is a flat JSON object, the other a ZIP archive.',
      cols: ['adapter id', 'kind', 'container', 'detect() score'],
      rows: [
        { label: 'backyard', cells: ['character', 'JSON', '0.9 strong keys, 0.55 weak persona heuristic'] },
        { label: 'byaf', cells: ['character', 'ZIP (.byaf)', '1'] },
      ],
    },
    detect: {
      type: 'flow', fig: 'fig·02', title: 'two unrelated detect() paths',
      caption:
        'The legacy adapter reads only text and scores in two tiers; the BYAF adapter reads only bytes and is binary: a schema-shaped manifest inside a ZIP, or nothing.',
      steps: [
        { label: 'Legacy: JSON object', sub: 'aiName / aiPersona / aiDisplayName / customDialogue -> 0.9', color: 'teal' },
        { label: 'Legacy: bare persona', sub: 'persona string, no description, kind != character -> 0.55', color: 'ochre' },
        { label: 'BYAF: ZIP signature', sub: 'PK bytes, manifest.json present', color: 'sage' },
        { label: 'BYAF: manifest shape', sub: 'characters[] + scenarios[] arrays -> 1', color: 'plum' },
      ],
    },
  },
};
