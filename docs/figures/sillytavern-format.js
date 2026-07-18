// ─────────────────────────────────────────────────────────────
// sillytavern-format.js: figure data for docs/reference/formats/
// sillytavern.md, keyed by page slug then figure id. Prose lives in
// the .md and drops a figure in with `@fig <id>`; this file is the
// data behind that id. Shapes (flow / matrix) mirror the portfolio
// figure spec. Every figure is grounded in src/formats/sillytavern/.
// ─────────────────────────────────────────────────────────────

export const figures = {
  sillytavern: {
    codecs: {
      type: 'matrix', fig: 'fig·01', title: 'four codecs, one folder',
      caption:
        'The SillyTavern folder default-exports four adapters (src/formats/sillytavern/index.ts). Each detects its own wire shape and maps to its own entity kind. The character reader scores 0.9 so a more specific reader (RoleCall, 1.0) wins the same card.',
      cols: ['adapter id', 'kind', 'container', 'detect() score'],
      rows: [
        { label: 'sillytavern', cells: ['character', 'PNG or JSON', '0.9'] },
        { label: 'sillytavern-lorebook', cells: ['lorebook', 'JSON', '0.9 file, 0.85 character_book'] },
        { label: 'sillytavern-regex', cells: ['regex', 'JSON', '0.9 array, 0.85 card block'] },
        { label: 'sillytavern-persona', cells: ['persona', 'JSON', '0.95'] },
      ],
    },
    detect: {
      type: 'flow', fig: 'fig·02', title: 'the character detect() path',
      caption:
        'detect() takes the first branch that matches and returns 0.9, else 0 (index.ts:87-92). A PNG with an embedded chara/ccv3 chunk wins on bytes; otherwise the JSON must be a recognizable card shape. The flat/v1 branch is gated by a real character field so a worldbook cannot pass as a character.',
      steps: [
        { label: 'PNG bytes', sub: 'chara or ccv3 tEXt chunk', color: 'teal' },
        { label: 'JSON card shape', sub: 'spec v3, spec v2, or flat', color: 'sage' },
        { label: 'Cross-kind firewall', sub: 'flat needs a character field', color: 'ochre' },
        { label: 'Score 0.9', sub: 'RoleCall 1.0 outranks it', color: 'plum' },
      ],
    },
  },
};
