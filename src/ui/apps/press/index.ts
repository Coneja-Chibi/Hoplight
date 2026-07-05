/**
 * The Press - convert/export as its own app (the locked shell's third tile). Its real room is the
 * export flow (JOURNEY 2.4, not yet designed), so this canvas is a truthful placeholder: a ghost
 * slot stating what arrives, never a fake feature (the lit-vs-ghost law).
 */
import type { VaudeApp } from "../../app-contract";

/** the locked press mark (vs-shell-apps) */
const MARK_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="3" width="14" height="4"/><path d="M7 7v3M17 7v3"/><rect x="4" y="14" width="16" height="6"/><path d="M9 10.5 12 13l3-2.5"/></svg>';

const app: VaudeApp = {
  manifest: {
    id: "press",
    title: "The Press",
    markSvg: MARK_SVG,
    accent: "#8b5cf6",
    order: 30,
    subtitle: "app · convert",
  },
  mount(ctx) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "min-height:100%;display:flex;align-items:center;justify-content:center;padding:var(--gap-l)";
    const slot = document.createElement("div");
    slot.style.cssText =
      "border:2px dashed var(--text-faint);color:var(--text-dim);padding:2rem 3rem;font-style:italic;font-weight:600;font-size:1.05rem;text-align:center";
    slot.textContent = "The Press is being built. Your exports will print here.";
    wrap.append(slot);
    ctx.root.replaceChildren(wrap);
  },
};

export default app;
