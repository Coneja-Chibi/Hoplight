/**
 * Vendor stub: the ONE React instance for the whole page (ADR-008). Every other bundle (boot,
 * apps, setup steps) marks "react" external and resolves it here through the import map in
 * index.html. Two React copies on one page = null-dispatcher hook crashes (the first React boot
 * died exactly this way); this stub is the cure, structurally.
 */
// @ts-expect-error TS2498 - @types/react still declares the CJS `export =` shape; the RUNTIME
// re-export below is correct and is what the import map serves (typed consumers never import
// this stub directly, they import "react" and get @types/react as usual)
export * from "react";
export { default } from "react";
