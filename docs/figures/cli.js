// ─────────────────────────────────────────────────────────────
// cli.js: figure data for docs/reference/cli.md, keyed by page
// slug then figure id. Prose lives in the .md and drops a figure
// in with `@fig <id>`; this file is the data behind that id.
// Shapes (flow / matrix) mirror the portfolio figure spec. Every
// figure is grounded in src/cli.ts and src/cli-io.ts.
// ─────────────────────────────────────────────────────────────

export default {
  cli: {
    convert: {
      type: 'flow', fig: 'fig·01', title: 'the convert pipeline',
      caption:
        'hoplight convert runs six checked steps before a byte is written: a bad output path, an unresolvable ' +
        'target, or an adapter that lies about its own output all fail closed before publishAtomic ever ' +
        'opens a file (cli.ts:299-389, cli-io.ts:112-239).',
      steps: [
        { label: 'Guard output', sub: 'not in-place · exists needs --yes', color: 'clay' },
        { label: 'Detect source', sub: 'registry.detect()', color: 'sage' },
        { label: 'Resolve target', sub: '--to or output extension', color: 'ochre' },
        { label: 'convertFile', sub: 'canonical convert + lorebook bundle', color: 'teal' },
        { label: 'Container agreement', sub: 'bytes/text must match the extension', color: 'plum' },
        { label: 'publishAtomic', sub: 'temp file + fsync + rename', color: 'rose' },
      ],
    },
  },
};
