/**
 * The Company - the house agent's future door (JOURNEY Act 4). Docked DIMMED per the locked shell:
 * an honest "installs later" tile, never mountable until the act lands. Its presence in the dock is
 * the moddability promise made visible.
 */
import type { AppContext, VaudeApp } from "../../app-contract";

/** the locked player-silhouette mark (vs-shell-apps) */
const MARK_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-4 3.4-6 7-6s7 2 7 6"/></svg>';

/** never rendered while comingSoon; the shell disables the tile and never loads this module's bundle */
function Company(_props: { ctx: AppContext }): null {
  return null;
}

const app: VaudeApp = {
  manifest: {
    id: "company",
    title: "The Company",
    markSvg: MARK_SVG,
    accent: "#2aa198", // hardcode-ok: app identity accent, not theme chrome
    order: 90,
    comingSoon: true,
    catalogOnly: true,
  },
  Component: Company,
};

export default app;
