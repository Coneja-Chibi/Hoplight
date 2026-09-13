// src/ui/apps/company/agent-surface.ts
import { useEffect, useRef } from "react";
var COMPANY_AGENT_SURFACE = {
  describe: `The house agent's future door. It is docked as an honest "installs later" tile and cannot be ` + "opened yet; nothing is edited, converted or stored behind it."
};
function companyAgentState() {
  return {
    headline: "The Company, which has no room behind it yet.",
    notes: [
      "This tile is dimmed in the dock on purpose: the act it belongs to has not shipped.",
      "Nothing can be opened, edited or exported from here. The Library and the Workbench are where " + "pieces live in the meantime."
    ]
  };
}
function usePublishCompanySurface(ctx) {
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  useEffect(() => {
    ctxRef.current.agent.publish(companyAgentState());
  }, []);
}

// src/ui/apps/company/index.tsx
var MARK_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-4 3.4-6 7-6s7 2 7 6"/></svg>';
function Company({ ctx }) {
  usePublishCompanySurface(ctx);
  return null;
}
var app = {
  manifest: {
    id: "company",
    title: "The Company",
    markSvg: MARK_SVG,
    accent: "#2aa198",
    order: 90,
    comingSoon: true,
    catalogOnly: true,
    agentSurface: COMPANY_AGENT_SURFACE
  },
  Component: Company
};
var company_default = app;
export {
  company_default as default
};
