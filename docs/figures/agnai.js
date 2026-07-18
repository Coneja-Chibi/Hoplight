// ─────────────────────────────────────────────────────────────
// agnai.js: figure data for docs/reference/formats/agnai.md,
// keyed by page slug then figure id. Prose lives in the .md and
// drops a figure in with `@fig <id>`; this file is the data behind
// that id. Shapes (flow / matrix) mirror the portfolio figure spec.
// Every figure is grounded in src/formats/agnai/.
// ─────────────────────────────────────────────────────────────

export const figures = {
  agnai: {
    codecs: {
      type: 'matrix', fig: 'fig·01', title: 'two codecs, one folder',
      caption:
        'The Agnai folder default-exports two adapters (src/formats/agnai/index.ts:363): the character reader and its native memory-book lorebook codec. Both are specific, self-identifying JSON shapes, so neither needs to yield to a more generic reader the way SillyTavern yields to RoleCall.',
      cols: ['adapter id', 'kind', 'container', 'detect() score'],
      rows: [
        { label: 'agnai', cells: ['character', 'JSON', '1.0'] },
        { label: 'agnai-lorebook', cells: ['lorebook', 'JSON', '1.0 kind marker, 0.9 kind-less native, 0.7 character_book'] },
      ],
    },
  },
};
