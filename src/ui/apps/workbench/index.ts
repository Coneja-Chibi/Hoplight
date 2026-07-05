/**
 * The Workbench app - home. Slice 1 is a truthful placeholder: the dark stage with a ghost slot and
 * the honest note that the bench arrives next slice (never a fake feature, per the lit-vs-ghost law).
 * Its real build follows the editor slice; docking it now proves drop-in app discovery end to end.
 */
import type { VaudeApp } from "../../app-contract";

const MARK_SVG =
  '<svg viewBox="0 0 100 100"><g fill="currentColor"><rect x="10" y="64" width="80" height="8"/><polygon points="30,58 50,20 70,58"/><circle cx="24" cy="82" r="5"/><circle cx="50" cy="82" r="5"/><circle cx="76" cy="82" r="5"/></g></svg>';

const app: VaudeApp = {
  manifest: {
    id: "workbench",
    title: "The Workbench",
    markSvg: MARK_SVG,
    accent: "#e8a13a",
    order: 10,
  },
  mount(ctx) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "min-height:100%;display:flex;align-items:center;justify-content:center;padding:var(--gap-l)";
    wrap.className = "seam";
    const slot = document.createElement("div");
    slot.style.cssText =
      "border:2px dashed var(--ghost);color:var(--muted);padding:2rem 3rem;font-style:italic;font-weight:600;font-size:1.05rem;text-align:center";
    slot.textContent = "The bench is being built. Your pieces will thread here.";
    wrap.append(slot);
    ctx.root.replaceChildren(wrap);
    ctx.setStatus("The Workbench - under construction");
  },
};

export default app;
