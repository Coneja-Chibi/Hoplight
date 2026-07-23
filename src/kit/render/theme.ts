/**
 * Kit's terminal palette, the locked look (DECISIONS #23). Hand-mirrored from the studio's stage
 * tokens; later generated from tokens.css so the terminal and the studio never drift. The single
 * place Kit's colors live, so no view hardcodes a hex.
 */
export const theme = {
  well: "#0e0c10",
  panel: "#17161d",
  row: "#1d1a21",
  floor: "#141217",
  edge: "#000000",
  line: "#3a3542",
  text: "#f2eee9",
  soft: "#a89fb0",
  mut: "#6a6472",
  rose: "#e11d48",
  roseDeep: "#b4092f",
  teal: "#14b8a6",
  tealDeep: "#0f766e",
  gold: "#eab308",
  white: "#ffffff",
} as const;
