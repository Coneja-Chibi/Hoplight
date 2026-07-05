/**
 * The Company - the house agent's future door (JOURNEY Act 4). Docked DIMMED per the locked shell:
 * an honest "installs later" tile, never mountable until the act lands. Its presence in the dock is
 * the moddability promise made visible.
 */
import type { VaudeApp } from "../../app-contract";

const MARK_SVG =
  '<svg viewBox="0 0 100 100"><g fill="currentColor"><circle cx="35" cy="34" r="12"/><circle cx="65" cy="34" r="12"/><path d="M20 78 Q35 58 50 78 Q65 58 80 78 Z"/></g></svg>';

const app: VaudeApp = {
  manifest: {
    id: "company",
    title: "The Company",
    markSvg: MARK_SVG,
    accent: "#2aa198",
    order: 90,
    comingSoon: true,
  },
  mount() {
    /* never mounted while comingSoon; the shell disables the tile */
  },
};

export default app;
