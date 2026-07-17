/**
 * CSS Workshop dock app - folders-as-schema tile in Apps.
 * Thin shell: manifest + Room. Shared leaf: components/css-workshop.
 * Plan: docs/CSS-WORKSHOP-PLAN.md · Wireframes: design/vs-css-workshop*.html
 */
import type { VaudeApp } from "../../app-contract";
import { CssWorkshopRoom } from "./room";

/** palette mark (flat stroke; house grammar) */
const MARK_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
  '<path d="M12 3c-4.5 0-8 3.2-8 7.2 0 2.6 1.4 4.9 3.6 6.2V20h3.2v-2.1c.7.1 1.4.2 2.2.2 4.5 0 8-3.2 8-7.2S16.5 3 12 3z"/>' +
  '<circle cx="8.2" cy="10" r="1.1" fill="currentColor" stroke="none"/>' +
  '<circle cx="11.5" cy="7.8" r="1.1" fill="currentColor" stroke="none"/>' +
  '<circle cx="15" cy="10.2" r="1.1" fill="currentColor" stroke="none"/>' +
  "</svg>";

const app: VaudeApp = {
  manifest: {
    id: "css-workshop",
    title: "CSS Workshop",
    markSvg: MARK_SVG,
    accent: "#7c3aed", // hardcode-ok: per-app identity accent, not theming
    order: 35,
    subtitle: "app · style",
    agentSurface: {
      describe:
        "Assisted CSS authoring room. Starters, property knobs, plain CSS source, sealed preview. Copy or download for any host.",
    },
  },
  Component: ({ ctx }) => <CssWorkshopRoom ctx={ctx} />,
};

export default app;
