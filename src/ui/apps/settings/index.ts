/**
 * Settings - pinned in the dock's foot per the locked shell. Its full room is JOURNEY 3.2 (not
 * yet designed), so this canvas is a truthful placeholder; the tile itself is real chrome. Every
 * "change it later" promise from setup lands here when the room is designed.
 */
import type { VaudeApp } from "../../app-contract";

/** the locked gear mark (vs-shell-apps) */
const MARK_SVG =
  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3.1"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>';

const app: VaudeApp = {
  manifest: {
    id: "settings",
    title: "Settings",
    markSvg: MARK_SVG,
    accent: "#8a8496",
    order: 100,
    subtitle: "app",
    dockFoot: true,
  },
  mount(ctx) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "min-height:100%;display:flex;align-items:center;justify-content:center;padding:var(--gap-l)";
    const slot = document.createElement("div");
    slot.style.cssText =
      "border:2px dashed var(--text-faint);color:var(--text-dim);padding:2rem 3rem;font-style:italic;font-weight:600;font-size:1.05rem;text-align:center";
    slot.textContent = "Settings opens here. Everything from setup will be changeable soon.";
    wrap.append(slot);
    ctx.root.replaceChildren(wrap);
  },
};

export default app;
