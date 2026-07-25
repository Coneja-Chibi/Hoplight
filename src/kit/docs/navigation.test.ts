/**
 * Pure navigation projections: root, nested collection, pagination, audience, outline.
 */
import { describe, expect, test } from "bun:test";
import type { DocAnchor, DocRecord } from "../../docs/types";
import {
  browseDocs,
  collectionOf,
  findOutlineSection,
  flattenAnchors,
  nestAnchors,
  normalizeCollectionId,
  outlineDoc,
} from "./navigation";

const anchor = (
  text: string,
  slug: string,
  level: 2 | 3 = 2,
  extra: Partial<DocAnchor> = {},
): DocAnchor => ({
  text,
  slug,
  level,
  summary: extra.summary ?? "",
  topics: extra.topics ?? [],
  children: extra.children ?? [],
});

const doc = (partial: Partial<DocRecord> & Pick<DocRecord, "id" | "path" | "title">): DocRecord => ({
  audience: "dev",
  summary: "",
  tags: [],
  related: [],
  semanticSummary: "",
  topics: [],
  anchors: [],
  ...partial,
});

const docs: DocRecord[] = [
  doc({
    id: "01-VISION",
    path: "docs/01-VISION.md",
    title: "Vision",
    summary: "Product intent.",
    semanticSummary: "Full vision overview for four personas and five pillars.",
    topics: ["product vision", "five pillars"],
    anchors: [
      anchor("Who it's for", "who-its-for", 2, { summary: "Four personas." }),
      anchor("The five pillars", "the-five-pillars"),
    ],
  }),
  doc({
    id: "guide/getting-started",
    path: "docs/guide/getting-started.md",
    title: "Get started",
    audience: "user",
    summary: "Install and import.",
    tags: ["install"],
    anchors: [
      anchor("Install", "install"),
      anchor("First import", "first-import"),
    ],
  }),
  doc({
    id: "guide/importing",
    path: "docs/guide/importing.md",
    title: "Importing content",
    audience: "user",
    summary: "Bring cards in.",
    tags: ["import"],
  }),
  doc({
    id: "guide/platforms/agnai",
    path: "docs/guide/platforms/agnai.md",
    title: "Agnai",
    audience: "user",
    summary: "Agnai platform guide.",
    tags: ["agnai"],
    anchors: [
      anchor("Import", "import", 2, {
        summary: "How to import Agnai cards.",
        topics: ["agnai import"],
        children: [
          anchor("JSON shape", "json-shape", 3, {
            summary: "Persona map details.",
            topics: ["persona map"],
          }),
        ],
      }),
    ],
  }),
  doc({
    id: "reference/security/remote-access",
    path: "docs/reference/security/remote-access.md",
    title: "Remote access",
    summary: "LAN gates.",
    tags: ["security"],
    anchors: [
      anchor("The LAN gate", "the-lan-gate"),
      anchor("Approval flow", "approval-flow", 3),
      anchor("Two listeners", "two-listeners"),
    ],
  }),
  doc({
    id: "reference/ui",
    path: "docs/reference/ui.md",
    title: "Studio UI",
    summary: "The visual shell.",
  }),
];

describe("normalizeCollectionId", () => {
  test("accepts catalog ids and refuses path escape", () => {
    expect(normalizeCollectionId(undefined)).toBe("");
    expect(normalizeCollectionId("guide/platforms")).toBe("guide/platforms");
    expect(normalizeCollectionId("../SECURITY")).toBe(null);
    expect(normalizeCollectionId("guide/../x")).toBe(null);
  });
});

describe("collectionOf", () => {
  test("strips docs/ and filename", () => {
    expect(collectionOf(docs[0]!)).toBe("");
    expect(collectionOf(docs[1]!)).toBe("guide");
    expect(collectionOf(docs[3]!)).toBe("guide/platforms");
  });
});

describe("browseDocs", () => {
  test("root lists collections and root pages", () => {
    const result = browseDocs(docs);
    expect(result).not.toBeNull();
    expect(result!.collection).toBe(null);
    expect(result!.collections.map((c) => c.id)).toEqual(["guide", "reference"]);
    expect(result!.pages.map((p) => p.id)).toEqual(["01-VISION"]);
  });

  test("nested collection returns immediate children and direct pages", () => {
    const result = browseDocs(docs, { collection: "guide" });
    expect(result!.collections.map((c) => c.id)).toEqual(["guide/platforms"]);
    expect(result!.pages.map((p) => p.id)).toEqual(["guide/getting-started", "guide/importing"]);
  });

  test("paginates pages only", () => {
    const result = browseDocs(docs, { collection: "guide", offset: 1, limit: 1 });
    expect(result!.pages.map((p) => p.id)).toEqual(["guide/importing"]);
    expect(result!.totalPages).toBe(2);
    expect(result!.offset).toBe(1);
    expect(result!.limit).toBe(1);
  });

  test("filters by audience and caps limit at 25", () => {
    const result = browseDocs(docs, { audience: "user", limit: 100 });
    expect(result!.limit).toBe(25);
    expect(result!.pages.every((p) => p.audience === "user")).toBe(true);
  });

  test("refuses path-escape collections", () => {
    expect(browseDocs(docs, { collection: "../SECURITY" })).toBeNull();
  });

  test("empty semantic fields stay empty strings", () => {
    const result = browseDocs(docs, { collection: "guide" });
    expect(result!.pages[0]?.semanticSummary).toBe("");
  });
});

describe("nestAnchors and outlineDoc", () => {
  test("nests flat H3 under preceding H2", () => {
    const nested = nestAnchors(docs.find((d) => d.id === "reference/security/remote-access")!.anchors);
    expect(nested.map((s) => s.slug)).toEqual(["the-lan-gate", "two-listeners"]);
    expect(nested[0]!.children.map((c) => c.slug)).toEqual(["approval-flow"]);
  });

  test("preserves already-nested children", () => {
    const nested = nestAnchors(docs.find((d) => d.id === "guide/platforms/agnai")!.anchors);
    expect(nested[0]!.children[0]!.slug).toBe("json-shape");
  });

  test("outline returns semantic overview and nested map", () => {
    const outline = outlineDoc(docs[0]!);
    expect(outline.semanticSummary).toContain("four personas");
    expect(outline.sections[0]?.summary).toBe("Four personas.");
  });

  test("outline without semantic fields returns empty overview", () => {
    const outline = outlineDoc(docs.find((d) => d.id === "reference/ui")!);
    expect(outline.semanticSummary).toBe("");
  });

  test("finds one nested outline section without flattening the response", () => {
    const outline = outlineDoc(docs.find((d) => d.id === "guide/platforms/agnai")!);
    expect(findOutlineSection(outline.sections, "json-shape")?.summary)
      .toBe("Persona map details.");
    expect(findOutlineSection(outline.sections, "missing")).toBeNull();
  });

  test("flattenAnchors is depth-first", () => {
    const flat = flattenAnchors(docs.find((d) => d.id === "guide/platforms/agnai")!.anchors);
    expect(flat.map((a) => a.slug)).toEqual(["import", "json-shape"]);
  });
});
