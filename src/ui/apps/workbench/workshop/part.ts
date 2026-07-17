/**
 * Workshop rail parts: pure id union + list builder (filesystem-ish data, no DOM).
 */
import type { WorkshopModuleView } from "./module";

export type WorkshopPart =
  | "triggers"
  | "variables"
  | "graph"
  | "regex"
  | "virtual"
  | "background"
  | "modlua"
  | "modregex"
  | "modlore"
  | "recipes";

export interface RailPart {
  id: WorkshopPart;
  ico: string;
  label: string;
  count?: number | string;
  sealed?: boolean;
  tour?: string;
}

export function buildRailParts(args: {
  triggerCount: number;
  varCount: number;
  regexCount: number;
  mod: WorkshopModuleView | null;
}): RailPart[] {
  const card: RailPart[] = [
    { id: "recipes", ico: "+", label: "Starters", tour: "ws-starters" },
    { id: "triggers", ico: "D", label: "Triggers", count: args.triggerCount },
    { id: "graph", ico: "G", label: "State map", tour: "ws-graph" },
    { id: "variables", ico: "=", label: "Variables", count: args.varCount },
    { id: "regex", ico: "/", label: "Regex", count: args.regexCount },
    { id: "virtual", ico: "</>", label: "Virtual script", sealed: true },
    { id: "background", ico: "#", label: "Background", sealed: true },
  ];
  if (!args.mod) return card;
  return [
    ...card,
    { id: "modlua", ico: "</>", label: "Package scripts", sealed: true, count: "adv" },
    { id: "modregex", ico: "/", label: "Module regex", count: args.mod.regexCount },
    { id: "modlore", ico: "L", label: "Module lore", count: args.mod.lorebookCount },
  ];
}

/** Default center pane: Starters when empty, Triggers when the card already has rules. */
export const defaultPart = (triggerCount: number): WorkshopPart =>
  triggerCount === 0 ? "recipes" : "triggers";
