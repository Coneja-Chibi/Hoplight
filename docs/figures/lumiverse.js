// ─────────────────────────────────────────────────────────────
// lumiverse.js: figure data for docs/reference/formats/lumiverse.md,
// keyed by page slug then figure id. Prose lives in the .md and drops
// a figure in with `@fig <id>`; this file is the data behind that id.
// Shapes (flow / matrix) mirror the portfolio figure spec. Every
// figure is grounded in src/formats/lumiverse/.
// ─────────────────────────────────────────────────────────────

export const figures = {
  lumiverse: {
    codecs: {
      type: 'matrix', fig: 'fig·01', title: 'three codecs, one folder',
      caption:
        'The Lumiverse folder default-exports three adapters (src/formats/lumiverse/index.ts:265). The character adapter reads PNG, JSON, or the modules ZIP and writes .json or .charx; the other two are single-shape codecs.',
      cols: ['adapter id', 'kind', 'container', 'detect() score'],
      rows: [
        { label: 'lumiverse', cells: ['character', 'PNG, JSON, or ZIP', '1 zip+modules, 0.96 zip+fingerprint, 0.95 PNG/JSON+fingerprint'] },
        { label: 'lumiverse-regex', cells: ['regex', 'JSON', '1, self-identifying envelope'] },
        { label: 'lumiverse-persona', cells: ['persona', 'JSON', '0.95, pronoun triplet'] },
      ],
    },
    detect: {
      type: 'flow', fig: 'fig·02', title: 'the character detect() path',
      caption:
        'detect() branches on container first, then on a Lumiverse fingerprint in extensions (index.ts:82-113). A modules ZIP scores 1; a bare charx cedes to Risu on module.risum but claims 0.96 with a fingerprinted card.json; PNG and plain JSON both need the fingerprint to score 0.95. A real modules ZIP also scores 1 on the Risu adapter, an unresolved tie broken by registration order, not content.',
      steps: [
        { label: 'ZIP bytes (PK)', sub: 'lumiverse_modules.json present', color: 'teal' },
        { label: 'module.risum, no modules.json', sub: 'cede to Risu, score 0', color: 'ochre' },
        { label: 'card.json + fingerprint', sub: 'no modules.json, score 0.96', color: 'sage' },
        { label: 'PNG or plain JSON', sub: 'fingerprint required, score 0.95', color: 'clay' },
        { label: 'No fingerprint', sub: 'score 0, ST reads it at 0.9', color: 'plum' },
      ],
    },
  },
};
