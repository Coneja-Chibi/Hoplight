/**
 * Kit's terminal palette, the locked look (DECISIONS #23-27). Hand-mirrored from the studio's stage
 * tokens; later generated from tokens.css so the terminal and the studio never drift. The single
 * place Kit's colors live, so no view hardcodes a hex. Innards run dark (a deep stage); the carved
 * input ledge and the bright confide voice have their own tokens per the design bible.
 */
export const theme = {
  well: "#08080a", // the deep stage floor (darker innards)
  panel: "#141217",
  row: "#201d27", // selection highlight
  floor: "#0c0b10",
  sunken: "#0b0a0e", // recessed field fill
  edge: "#000000",
  line: "#3a3542",
  text: "#f2eee9",
  soft: "#a89fb0", // body / explanation
  bright: "#e4e4e7", // the confide voice (bible: never muted for this)
  mut: "#6a6472",
  rose: "#e11d48",
  roseDeep: "#b4092f",
  teal: "#14b8a6",
  tealDeep: "#0f766e",
  gold: "#eab308",
  alive: "#22c55e", // the connected/alive dot in the status bar
  white: "#ffffff",
  stamp: "#2b2734", // the heavy pressed ledge (carved bottom + right edges)
  stampDim: "#141019", // the recessed thin edge (carved top + left)
} as const;
