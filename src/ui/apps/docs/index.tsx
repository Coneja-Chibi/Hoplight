/** Help / Docs: the committed documentation corpus, packaged as a first-class app room. */
import type { HoplightApp } from "../../app-contract";
import { DocsRoom } from "./room";

const MARK_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' +
  '<path d="M12 5.5C10.5 4.3 8.5 3.7 6 3.7c-1 0-2 .1-3 .4v14.4c1-.3 2-.4 3-.4 2.5 0 4.5.6 6 1.8"/>' +
  '<path d="M12 5.5c1.5-1.2 3.5-1.8 6-1.8 1 0 2 .1 3 .4v14.4c-1-.3-2-.4-3-.4-2.5 0-4.5.6-6 1.8z"/>' +
  "</svg>";

const app: HoplightApp = {
  manifest: {
    id: "docs",
    title: "Help / Docs",
    markSvg: MARK_SVG,
    accent: "#3b82f6", // hardcode-ok: app identity accent, not theme chrome
    order: 70,
    subtitle: "app · help",
    catalogOnly: true,
    agentSurface: {
      describe: "Everything about Hoplight, readable here or on GitHub from the same source.",
    },
  },
  Component: DocsRoom,
};

export default app;
