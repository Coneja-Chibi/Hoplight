import { expect, test } from "bun:test";
import { cssClassNames, extractCatalogEntries } from "./catalog-lib";

test("cssClassNames walks module-css classes in order, deduped, comments ignored", () => {
  const css = `
/* .ghost never counts */
.card{color:red}
.card:hover{color:blue}
.h > .k, .dot.full{border:0}
@media (max-width:40rem){ .card{padding:0} .mv{display:none} }
`;
  expect(cssClassNames(css)).toEqual(["card", "h", "k", "dot", "full", "mv"]);
  expect(cssClassNames("")).toEqual([]);
});

test("finds a React function component that returns JSX", () => {
  const src = `
/** The tile that names an open piece on the tab strip. */
export function TabChip(props: { name: string; onClose(): void }): JSX.Element {
  return <span className="tab">{props.name}</span>;
}
`;
  const out = extractCatalogEntries("src/ui/components/tab-chip.tsx", src);
  expect(out).toEqual([
    {
      name: "TabChip",
      file: "src/ui/components/tab-chip.tsx",
      kind: "component",
      signature: '(props: { name: string; onClose(): void })',
      doc: "The tile that names an open piece on the tab strip.",
    },
  ]);
});

test("finds an arrow component typed with a props interface", () => {
  const src = `
interface DockTileProps {
  title: string;
  accent: string;
}

/** One dock tile: mark box + name + mono subtitle. */
export const DockTile = (props: DockTileProps): JSX.Element => {
  return <button className="apptile">{props.title}</button>;
};
`;
  const out = extractCatalogEntries("src/ui/shell/dock-tile.tsx", src);
  expect(out).toEqual([
    {
      name: "DockTile",
      file: "src/ui/shell/dock-tile.tsx",
      kind: "component",
      signature: "(props: DockTileProps)",
      doc: "One dock tile: mark box + name + mono subtitle.",
    },
  ]);
});

test("prefers the FC<Props> type annotation over the param list as the signature", () => {
  const src = `
/** The tab strip's close glyph, typed via the FC generic instead of an inline param type. */
export const CloseGlyph: React.FC<CloseGlyphProps> = (props) => {
  return <span onClick={props.onClose}>x</span>;
};
`;
  const out = extractCatalogEntries("src/ui/components/close-glyph.tsx", src);
  expect(out).toEqual([
    {
      name: "CloseGlyph",
      file: "src/ui/components/close-glyph.tsx",
      kind: "component",
      signature: "React.FC<CloseGlyphProps>",
      doc: "The tab strip's close glyph, typed via the FC generic instead of an inline param type.",
    },
  ]);
});

test("finds a legacy create*/swatch*/inject* factory in src/ui/_shared", () => {
  const src = `
/** One swatch button. No selection logic: the host toggles .on. */
export function swatchButton(choice: { hex: string; label: string }): HTMLButtonElement {
  const btn = document.createElement("button");
  return btn;
}
`;
  const out = extractCatalogEntries("src/ui/_shared/swatches.ts", src);
  expect(out).toEqual([
    {
      name: "swatchButton",
      file: "src/ui/_shared/swatches.ts",
      kind: "legacy-widget",
      signature: "(choice: { hex: string; label: string })",
      doc: "One swatch button. No selection logic: the host toggles .on.",
    },
  ]);
});

test("ignores non-component and non-factory exports", () => {
  const src = `
/** Not a component: lowercase name, plain object. */
export const HOUSE_PALETTE = [{ id: "rose", hex: "#e11d48" }];

/** Not a factory: uppercase but not create/build/swatch/inject, and this file is legacy-scoped. */
export function Deck(): void {
  doSomething();
}

export function helperFn(x: number): number {
  return x + 1;
}
`;
  expect(extractCatalogEntries("src/ui/_shared/decks.ts", src)).toEqual([]);
  expect(extractCatalogEntries("src/ui/components/whatever.ts", src)).toEqual([]); // not .tsx, not _shared
});

test("extracts only the first line of a multi-line doc block, and copes with no doc", () => {
  const src = `
/**
 * The house color-swatch row for plain hosts (settings/editor panels).
 * Injects its own css and owns selection state.
 */
export function swatchRow(opts: { palette: unknown[]; onPick(): void }): { root: HTMLElement } {
  return { root: document.createElement("div") };
}

export function injectSwatchCss(): void {
  return;
}
`;
  const out = extractCatalogEntries("src/ui/_shared/swatches.ts", src);
  expect(out.find((e) => e.name === "swatchRow")?.doc).toBe(
    "The house color-swatch row for plain hosts (settings/editor panels).",
  );
  expect(out.find((e) => e.name === "injectSwatchCss")?.doc).toBe("");
});
