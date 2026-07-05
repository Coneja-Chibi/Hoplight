/**
 * The Workbench app - home. Slice 1 is a truthful placeholder: the dark stage with a ghost slot and
 * the honest note that the bench arrives next slice (never a fake feature, per the lit-vs-ghost law).
 * Its real build follows the editor slice; docking it now proves drop-in app discovery end to end.
 */
import type { VaudeApp } from "../../app-contract";

/** the locked bench mark (vs-shell-apps) */
const MARK_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="13"/><path d="M3 17h18"/><rect x="9" y="10" width="6" height="7" fill="currentColor" stroke="none"/></svg>';

const app: VaudeApp = {
  manifest: {
    id: "workbench",
    title: "The Workbench",
    markSvg: MARK_SVG,
    accent: "#e6a52a",
    order: 10,
    subtitle: "app · home",
  },
  mount(ctx) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "min-height:100%;display:flex;align-items:center;justify-content:center;padding:var(--gap-l)";
    const slot = document.createElement("div");
    slot.style.cssText =
      "border:2px dashed var(--text-faint);color:var(--text-dim);padding:2rem 3rem;font-style:italic;font-weight:600;font-size:1.05rem;text-align:center";
    slot.textContent = "The bench is being built. Your pieces will thread here.";
    wrap.append(slot);
    ctx.root.replaceChildren(wrap);
    ctx.setStatus("The Workbench - under construction");
  },
};

export default app;
