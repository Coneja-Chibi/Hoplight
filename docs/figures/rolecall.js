// ─────────────────────────────────────────────────────────────
// rolecall.js: figure data for docs/reference/formats/rolecall.md,
// keyed by page slug then figure id. Prose lives in the .md and
// drops a figure in with `@fig <id>`; this file is the data behind
// that id. Shapes (flow / matrix) mirror the portfolio figure spec.
// Every figure is grounded in src/formats/rolecall/.
// ─────────────────────────────────────────────────────────────

export const figures = {
  rolecall: {
    codecs: {
      type: 'matrix', fig: 'fig·01', title: 'four codecs, one folder',
      caption:
        'The RoleCall folder default-exports four adapters (src/formats/rolecall/index.ts:405). Character and persona share the exact same CCv2/V3 wire shape; the literal extensions.rolecall.type === "persona" discriminator is what keeps them from tying at 1.0 on the same card (index.ts:344-356, persona.ts:48-62).',
      cols: ['adapter id', 'kind', 'container', 'detect() score'],
      rows: [
        { label: 'rolecall', cells: ['character', 'PNG or JSON', '1.0 (0 without extensions.rolecall, or if type is "persona")'] },
        { label: 'rolecall-lorebook', cells: ['lorebook', 'JSON', '1.0'] },
        { label: 'rolecall-persona', cells: ['persona', 'JSON', '1.0 on both shapes'] },
        { label: 'rolecall-regex', cells: ['regex', 'JSON', '0.9'] },
      ],
    },
    detect: {
      type: 'flow', fig: 'fig·02', title: 'the character detect() path',
      caption:
        'detect() must clear every gate before it returns 1, else 0 (index.ts:348-356). A card whose extensions.rolecall.type is the literal "persona" is the RoleCall persona-export shape reused for a character card; the character adapter steps aside and toCanonical throws pointing at rolecall-persona (index.ts:355,366), so the two adapters never tie at 1.0 on the same file.',
      steps: [
        { label: 'CCv2/V3 shape', sub: 'spec + data object present', color: 'sage' },
        { label: 'extensions.rolecall block', sub: 'absent -> score 0', color: 'teal' },
        { label: "type !== 'persona'", sub: 'cross-kind firewall', color: 'ochre' },
        { label: 'Score 1.0', sub: 'outranks the generic SillyTavern reader at 0.9', color: 'plum' },
      ],
    },
  },
};
