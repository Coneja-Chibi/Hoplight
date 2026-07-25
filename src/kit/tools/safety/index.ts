/**
 * index: the named public API of the safety cluster. This folder is a cluster of collaborators, not a
 * single drop-in spoke, so it exports named symbols (no default adapter). session.ts and app.tsx wire
 * the gate through these; the render shells import the cores directly for their view concerns.
 */
export { makeGatedDispatch } from "./gated-dispatch";
export type { GateSeam, GateRequest } from "./gated-dispatch";
export { classifyRisk } from "./risk";
export type { ToolAccess, RiskLevel, RiskVerdict } from "./risk";
export { resolveAccess } from "./access";
export { decideGate, isFloor } from "./gate-core";
export type { GateState, PermissionMode, GateDecision } from "./gate-core";
export { initGate, applyGateChoice } from "./permission-mode";
export type { GateChoice } from "./permission-mode";
export { summarizePeek } from "./peek-core";
export type { PeekView } from "./peek-core";
export { stripeFor } from "./stripe-core";
export type { StripeView } from "./stripe-core";
