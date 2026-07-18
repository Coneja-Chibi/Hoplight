// ─────────────────────────────────────────────────────────────
// troubleshooting.js - figure data for docs/guide/troubleshooting.md,
// keyed by slug then figure id. Prose lives in the .md and drops a
// figure in with a line like `@fig causes`; this is the data behind
// that id. Copies the local `tree` shape (docs/figures/lorebook.js);
// imports nothing. Renderer comes later; the marker is inert for now.
// Grounded in src/ui/receipt.ts (UNKNOWN_FILE_MESSAGE, the extras
// lines), src/studio/store.test.ts + bundle.test.ts (the -2 keep-both
// suffix), and docs/guide/importing.md.
// ─────────────────────────────────────────────────────────────

export const figures = {
  troubleshooting: {
    causes: {
      type: "tree",
      fig: "fig·01",
      title: "why an import didn't land the way you expected",
      caption:
        "Every import problem sorts into one of three shapes: the file never read at all, it read but you got more (or less) than one piece, or it read clean and something inside it looks different than you assumed. The receipt already names which one you're in; this is that same split, laid out.",
      root: {
        label: "Import didn't do what you expected",
        kind: "root",
        sum: "Start with the receipt. It already states which of the three branches below you're in.",
        children: [
          {
            label: "It would not read at all",
            kind: "group",
            sum: "\"We could not read this one.\" A format question, not a damage question.",
            children: [
              { label: "Unrecognized format", kind: "field", sum: "Not a card, book, or persona shape Vaude knows yet. Check docs/FORMAT-SUPPORT.md." },
              { label: "Right shape, wrong kind guess", kind: "field", sum: "Run vaud label to see what Vaude thinks the file is and why." },
            ],
          },
          {
            label: "It landed, but not once",
            kind: "group",
            sum: "Importing never overwrites, so a repeat drop always makes a new piece.",
            children: [
              { label: "The same file, dropped twice", kind: "field", sum: "The second copy gets -2 tacked onto its id, on purpose." },
              { label: "An embedded lorebook stepped out on its own", kind: "field", sum: "One receipt row can still mean two saved pieces: the character and its book." },
            ],
          },
          {
            label: "It read clean, but something's off",
            kind: "group",
            sum: "The receipt's extra lines say exactly what changed and why.",
            children: [
              { label: "A lorebook got healed", kind: "field", sum: "A missing name or malformed entry is repaired on the way in, not rejected." },
              { label: "Scripts show up as text", kind: "field", sum: "Carried as data on purpose; nothing on a card executes just because you imported it." },
              { label: "A deep-access request was refused", kind: "field", sum: "The card still imports; that one request just doesn't get granted." },
            ],
          },
        ],
      },
    },
  },
};
