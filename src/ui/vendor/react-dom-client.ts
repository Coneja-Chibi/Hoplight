/**
 * Vendor stub: the shared DOM renderer entry. Explicit named re-exports because react-dom ships
 * CJS, and `export *` from a CJS module silently drops the named exports at bundle time. Bare
 * "react-dom" (createPortal lives there, not in /client) maps to this SAME bundle in the page's
 * import map, so both specifiers resolve to the one react-dom instance.
 */
import * as ns from "react-dom/client";
import * as dom from "react-dom";

const m = (ns as { default?: Record<string, unknown> }).default ?? (ns as Record<string, unknown>);
const d = (dom as { default?: Record<string, unknown> }).default ?? (dom as Record<string, unknown>);

export const createRoot = (m as Record<string, unknown>).createRoot ?? (ns as Record<string, unknown>).createRoot;
export const hydrateRoot = (m as Record<string, unknown>).hydrateRoot ?? (ns as Record<string, unknown>).hydrateRoot;
export const createPortal = (d as Record<string, unknown>).createPortal ?? (dom as Record<string, unknown>).createPortal;
