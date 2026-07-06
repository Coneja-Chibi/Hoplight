/**
 * Vendor stub: the shared DEV automatic-JSX runtime. React ships CJS, and `export * from` a CJS
 * module does not reliably surface named exports in a bundled ESM graph (the third first-boot
 * crash: "does not provide an export named 'Fragment'"). Names are re-exported EXPLICITLY,
 * resolved through the CJS default when present. Same one-React law as vendor/react.ts.
 */
import * as ns from "react/jsx-dev-runtime";

const m = (ns as { default?: Record<string, unknown> }).default ?? (ns as Record<string, unknown>);

export const Fragment = (m as Record<string, unknown>).Fragment ?? (ns as Record<string, unknown>).Fragment;
export const jsxDEV = (m as Record<string, unknown>).jsxDEV ?? (ns as Record<string, unknown>).jsxDEV;
