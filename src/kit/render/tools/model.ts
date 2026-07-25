/**
 * Pure navigation model for the target, area, and action panes in Kit's capability browser.
 */
import type { EntitySummary } from "../../bridge";
import type { ContentCapability } from "../../../entities/capabilities";

export interface ToolsState {
  pane: 0 | 1 | 2;
  target: number;
  area: number;
  action: number;
}

export const initialToolsState = (): ToolsState => ({
  pane: 0,
  target: 0,
  area: 0,
  action: 0,
});

export const toolsAreas = (
  state: ToolsState,
  pieces: readonly EntitySummary[],
  capabilities: readonly ContentCapability[],
): string[] => {
  const kind = pieces[state.target]?.kind;
  return [...new Set(capabilities.filter((item) => item.kind === kind).map((item) => item.area))]
    .sort((a, b) => a.localeCompare(b));
};

export const toolsActions = (
  state: ToolsState,
  pieces: readonly EntitySummary[],
  capabilities: readonly ContentCapability[],
): ContentCapability[] => {
  const kind = pieces[state.target]?.kind;
  const area = toolsAreas(state, pieces, capabilities)[state.area];
  return capabilities
    .filter((item) => item.kind === kind && item.area === area)
    .sort((a, b) => a.action.localeCompare(b.action) || a.id.localeCompare(b.id));
};

const clamp = (value: number, count: number): number =>
  Math.max(0, Math.min(value, Math.max(0, count - 1)));

export function reduceTools(
  state: ToolsState,
  key: string,
  pieces: readonly EntitySummary[],
  capabilities: readonly ContentCapability[],
): { state: ToolsState; close?: true } {
  if (key === "escape" || key === "q") return { state, close: true };
  if (key === "left") return { state: { ...state, pane: Math.max(0, state.pane - 1) as 0 | 1 | 2 } };
  if (key === "right" || key === "return") {
    return { state: { ...state, pane: Math.min(2, state.pane + 1) as 0 | 1 | 2 } };
  }
  const delta = key === "up" ? -1 : key === "down" ? 1 : 0;
  if (!delta) return { state };
  if (state.pane === 0) {
    return {
      state: {
        ...state,
        target: clamp(state.target + delta, pieces.length),
        area: 0,
        action: 0,
      },
    };
  }
  if (state.pane === 1) {
    const areas = toolsAreas(state, pieces, capabilities);
    return { state: { ...state, area: clamp(state.area + delta, areas.length), action: 0 } };
  }
  const actions = toolsActions(state, pieces, capabilities);
  return { state: { ...state, action: clamp(state.action + delta, actions.length) } };
}
