// ─────────────────────────────────────────────────────────────
// risu-format.js: figure data for docs/reference/formats/risu.md,
// keyed by page slug then figure id. Prose lives in the .md and
// drops a figure in with `@fig <id>`; this file is the data behind
// that id. Shapes (flow / matrix) mirror the portfolio figure spec.
// Every figure is grounded in src/formats/risu/.
// ─────────────────────────────────────────────────────────────

export const figures = {
  risu: {
    codecs: {
      type: 'matrix', fig: 'fig·01', title: 'three codecs, one folder',
      caption:
        'The Risu folder default-exports three adapters (src/formats/risu/index.ts:191). Each detects its own wire shape and maps to its own entity kind; risu-regex has two file homes with two different scores.',
      cols: ['adapter id', 'kind', 'container', 'detect() score'],
      rows: [
        { label: 'risu', cells: ['character', '.charx (zip)', '1.0, card.json present'] },
        { label: 'risu-lorebook', cells: ['lorebook', 'json', '1, native envelope; 0.75, character_book extract'] },
        { label: 'risu-regex', cells: ['regex', '.risum module or json rows', '0.8, module; 0.85, rows file'] },
      ],
    },
    detect: {
      type: 'flow', fig: 'fig·02', title: 'the character detect() path',
      caption:
        'detect() takes the first branch that fails and returns 0, otherwise 1.0 (index.ts:87-95). It does not inspect the card spec or version, only whether card.json exists inside a zip.',
      steps: [
        { label: 'Zip magic', sub: 'first two bytes PK, else 0', color: 'teal' },
        { label: 'card.json present', sub: 'bounded single-entry inflate', color: 'sage' },
        { label: 'Score 1.0', sub: 'no spec or version check beyond presence', color: 'plum' },
      ],
    },
  },
};
