/**
 * The Press - convert/export as its own app (the locked shell's third tile). Its real room is the
 * export flow (JOURNEY 2.4, not yet designed), so this canvas is a truthful placeholder: a ghost
 * slot stating what arrives, never a fake feature (the lit-vs-ghost law).
 */
import type { JSX } from "react";
import type { AppContext, VaudeApp } from "../../app-contract";

/** the locked press mark (vs-shell-apps) */
const MARK_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="3" width="14" height="4"/><path d="M7 7v3M17 7v3"/><rect x="4" y="14" width="16" height="6"/><path d="M9 10.5 12 13l3-2.5"/></svg>';

/** transcribed 1:1 from the vanilla mount()'s inline cssText - no other consumer, so no module needed */
function Press(_props: { ctx: AppContext }): JSX.Element {
  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--gap-l)",
      }}
    >
      <div
        style={{
          border: "2px dashed var(--text-faint)",
          color: "var(--text-dim)",
          padding: "2rem 3rem",
          fontStyle: "italic",
          fontWeight: 600,
          fontSize: "1.05rem",
          textAlign: "center",
        }}
      >
        The Press is being built. Your exports will print here.
      </div>
    </div>
  );
}

const app: VaudeApp = {
  manifest: {
    id: "press",
    title: "The Press",
    markSvg: MARK_SVG,
    accent: "#8b5cf6", // hardcode-ok: per-app identity accent, not theming
    order: 30,
    subtitle: "app · convert",
  },
  Component: Press,
};

export default app;
