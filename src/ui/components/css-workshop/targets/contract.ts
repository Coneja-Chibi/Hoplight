/**
 * Target pack contract: named selectors + sealed mock HTML for preview.
 * Packs are adapters; the core still emits universal CSS.
 */

export interface CssTarget {
  /** stable id within the pack */
  id: string;
  /** short label for the assist UI */
  label: string;
  /** CSS selector inserted into new rules */
  selector: string;
  help?: string;
}

export interface CssTargetPack {
  /** pack id (folder / registry key) */
  id: string;
  title: string;
  blurb: string;
  /** mock HTML shell for sealed preview (styled by author CSS) */
  mockHtml: string;
  targets: readonly CssTarget[];
  /** optional sort */
  order?: number;
}
