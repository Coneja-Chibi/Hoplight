/**
 * Vendor stub: the shared DOM renderer entry. Explicit named re-exports because react-dom ships
 * CJS and `export *` from CJS drops names (see vendor/jsx-dev-runtime.ts for the war story).
 */
import * as ns from "react-dom/client";

const m = (ns as { default?: Record<string, unknown> }).default ?? (ns as Record<string, unknown>);

export const createRoot = (m as Record<string, unknown>).createRoot ?? (ns as Record<string, unknown>).createRoot;
export const hydrateRoot = (m as Record<string, unknown>).hydrateRoot ?? (ns as Record<string, unknown>).hydrateRoot;
