// ─────────────────────────────────────────────────────────────
// marinara.js: figure data for docs/reference/formats/marinara.md,
// keyed by figure id. Prose lives in the .md and drops a figure in
// with a line like `@fig codecs`; this file is the data behind that
// id. Shapes (flow / matrix) mirror the portfolio figure spec.
// Grounded in src/formats/marinara/index.ts (readMarinaraRows).
// ─────────────────────────────────────────────────────────────

export default {
  codecs: {
    type: "matrix",
    fig: "fig·01",
    title: "two codecs, one folder",
    caption:
      "The Marinara folder default-exports two adapters (index.ts:98): marinara-regex reads a bare " +
      "MarinaraRegexScript API dump array, marinara-persona reads a Marinara persona object. Both " +
      "score 0.95, which is what lets marinara-regex outbid SillyTavern's 0.9 bid on the same " +
      "findRegex/replaceString wire shape; see Detection.",
    cols: ["adapter id", "kind", "container", "detect() score"],
    rows: [
      { label: "marinara-regex", cells: ["regex", "JSON array", "0.95"] },
      { label: "marinara-persona", cells: ["persona", "JSON object", "0.95"] },
    ],
  },
  detect: {
    type: "flow",
    fig: "fig·02",
    title: "the regex detect() gate sequence",
    caption:
      "readMarinaraRows runs four gates in order and returns null on the first failure " +
      "(index.ts:50-59). Only a file that clears all four scores 0.95, which is what lets " +
      "it outbid SillyTavern's 0.9 bid on the same findRegex/replaceString wire shape.",
    steps: [
      { label: "Bare row array", sub: "non-empty, every row an object", color: "sage" },
      { label: "No scriptName key", sub: "ST dialect rejected outright", color: "ochre" },
      { label: "Every row parses", sub: "string id + string findRegex", color: "teal" },
      { label: "Marinara-distinct signal", sub: "targetCharacterIds, order, or string placement", color: "clay" },
      { label: "Score 0.95", sub: "outbids ST's 0.9 on the same file", color: "plum" },
    ],
  },
};
