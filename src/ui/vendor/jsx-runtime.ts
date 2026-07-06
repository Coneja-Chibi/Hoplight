/**
 * Vendor stub: the shared automatic-JSX runtime. Explicit named re-exports because React ships
 * CJS and `export *` from CJS drops names (see vendor/jsx-dev-runtime.ts for the war story).
 */
import * as ns from "react/jsx-runtime";

const m = (ns as { default?: Record<string, unknown> }).default ?? (ns as Record<string, unknown>);

export const Fragment = (m as Record<string, unknown>).Fragment ?? (ns as Record<string, unknown>).Fragment;
export const jsx = (m as Record<string, unknown>).jsx ?? (ns as Record<string, unknown>).jsx;
export const jsxs = (m as Record<string, unknown>).jsxs ?? (ns as Record<string, unknown>).jsxs;
