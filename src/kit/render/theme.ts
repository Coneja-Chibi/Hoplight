/**
 * Kit's terminal palette, the locked look (DECISIONS #23-27, refined with Chi 2026-07-24). Hand-mirrored
 * from the studio's stage tokens. The single place Kit's colors live, so no view hardcodes a hex.
 *
 * The conversation is a stack of shaded bands with real tonal contrast: `lift` is where your line and
 * active rows sit (clearly raised), `recess` is where replies rest (near-black), `floor`/`panel` carry
 * boxes and headers, `div` draws the band dividers. `line` is the heavy frame + field borders. `mut`/`line`
 * are BORDERS ONLY, never text; text floors at `quiet` so nothing reads as dim-grey.
 */
export const theme = {
  well: "#0e0c10", // the deep stage floor, base of the conversation
  recess: "#0b090d", // recessed band (replies, system, folded moves)
  floor: "#141217", // one step up: box bodies, the input zone
  panel: "#17161d", // a step lighter: box + menu headers
  lift: "#272130", // clearly raised: your line, the active menu/list row (real contrast)
  row: "#201d27",
  sunken: "#0b0a0e", // recessed field fill (code slabs, masked key field)
  edge: "#000000",
  seam: "#2b2833",
  line: "#4a4556", // the heavy line-grey frame + field borders (the stamp)
  div: "#3a3444", // band dividers, visible
  text: "#f2eee9",
  bright: "#e4e4e7", // the confide voice (bible: never muted for this)
  soft: "#b3aabd", // body / explanation, the legible floor for text
  quiet: "#8f8a9b", // the quietest legible text (hints, counts), still readable
  mut: "#6a6472", // BORDERS / rules only, never text
  rose: "#e11d48",
  roseDeep: "#b4092f",
  teal: "#2dd4bf",
  tealDeep: "#0f766e",
  gold: "#eab308",
  goldDim: "#4a3d10",
  violet: "#a78bfa",
  violetDeep: "#6d28d9",
  alive: "#22c55e", // the connected/alive dot in the status bar
  red: "#f16a6a", // destructive
  white: "#ffffff",
  stamp: "#2b2734",
  stampDim: "#141019",
} as const;

/**
 * VERB palette: a classic menu palette assigned by meaning. Cool hues = safe reads (each read verb its
 * own cool color), warm = writes, red = destructive, violet = egress. A tool row's spine echoes its verb,
 * so the color family still reads risk at a glance while every verb is distinct. Unknown verbs fall back.
 */
export const verbColor: Record<string, string> = {
  list: "#6aa5f0",
  read: "#5bd995",
  search: "#4fd6e0",
  triage: "#2dd4bf",
  inspect: "#7fb2f2",
  write: "#e8b64a",
  shelve: "#e8b64a",
  save: "#e8b64a",
  import: "#e8b64a",
  tag: "#e6c15c",
  edit: "#ef9f5a",
  delete: "#f16a6a",
  fetch: "#b79cf5",
  send: "#b79cf5",
};

/** The fallback verb color for an unmapped tool (a neutral bright, never dim). */
export const verbFallback = theme.bright;

/**
 * SURFACE kind colors: a tool's target colors by what it touches (the second axis). A named piece uses
 * its own accent instead (read from the entity); these are the fallbacks for the deck kinds themselves.
 */
export const kindColor: Record<string, string> = {
  character: "#ef9aa4",
  characters: "#ef9aa4",
  lorebook: "#86bcdc",
  lorebooks: "#86bcdc",
  regex: "#b79cf5",
  preset: "#e6c15c",
  presets: "#e6c15c",
};

/** Resolve a verb to its palette color, falling back to a neutral bright for unknown verbs. */
export const colorForVerb = (verb: string): string => verbColor[verb.toLowerCase()] ?? verbFallback;
