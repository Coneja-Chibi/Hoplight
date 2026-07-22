/**
 * Kit's terminal palette, hand-mirrored from the studio's neobrutalist tokens.
 * Later this gets generated from tokens.css so the terminal and the studio never drift;
 * for now it is the single place Kit's colors live so no view hardcodes a hex.
 */
export const theme = {
  well: "#0e0c10",
  stage: "#141217",
  row: "#1d1a21",
  edge: "#000000",
  line: "#3a3542",
  text: "#f2eee9",
  soft: "#a89fb0",
  rose: "#e11d48",
  roseDeep: "#9f1239",
  teal: "#14b8a6",
  tealDeep: "#0f766e",
  gold: "#eab308",
  goldDeep: "#854d0e",
  white: "#ffffff",
} as const;
