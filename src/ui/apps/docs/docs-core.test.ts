/** Pure reader derivation tests: search, grouping, trusted assets, and in-app links. */
import { describe, expect, test } from "bun:test";
import {
  displayDocTitle,
  groupDocs,
  prepareDocSegments,
  searchDocs,
  targetFromAppHref,
} from "./docs-core";
import type { DocFigure, DocRecord } from "../../docs-types";

const docs: DocRecord[] = [
  {
    id: "guide/getting-started",
    path: "docs/guide/getting-started.md",
    title: "Get started",
    audience: "user",
    summary: "Install and make a first import.",
    tags: ["install"],
    related: [],
    anchors: [{ text: "First import", slug: "first-import", level: 2 }],
  },
  {
    id: "reference/ui",
    path: "docs/reference/ui.md",
    title: "Studio UI",
    audience: "dev",
    summary: "The visual shell.",
    tags: [],
    related: [],
    anchors: [],
  },
  {
    id: "guide/converting",
    path: "docs/guide/converting.md",
    title: "Convert a card",
    audience: "user",
    summary: "Move a card between platforms.",
    tags: [],
    related: [],
    anchors: [],
  },
];

describe("docs reader derivation", () => {
  test("searches titles, summaries, tags, and headings", () => {
    expect(searchDocs(docs, "install").map((doc) => doc.id)).toEqual(["guide/getting-started"]);
    expect(searchDocs(docs, "first import").map((doc) => doc.id)).toEqual(["guide/getting-started"]);
    expect(searchDocs(docs, "visual shell").map((doc) => doc.id)).toEqual(["reference/ui"]);
  });

  test("groups into human-facing user and developer shelves", () => {
    const grouped = groupDocs(docs);
    expect(grouped.map((group) => group.label)).toEqual(["User Docs", "Developer Docs"]);
    expect(grouped[0]?.sections.map((section) => section.label)).toEqual(["Start Here", "Workflows"]);
    expect(grouped[1]?.sections.map((section) => section.label)).toEqual(["Application & API"]);
  });

  test("presents decision records as readable technical decisions, not ADR codes", () => {
    expect(displayDocTitle({
      ...docs[1]!,
      id: "decisions/ADR-001-runtime",
      path: "docs/decisions/ADR-001-runtime.md",
      title: "ADR-001: Runtime - Bun + TypeScript, Node-compatible core",
    })).toBe("Runtime: Bun + TypeScript, Node-compatible core");
    expect(displayDocTitle({
      ...docs[1]!,
      id: "decisions/ADR-008-react-ui",
      path: "docs/decisions/ADR-008-react-ui.md",
      title: "ADR-008: React UI layer (supersedes ADR-007's deferral)",
    })).toBe("React UI layer");
  });

  test("strips frontmatter, mounts trusted figures, and rewrites repo doc links", () => {
    const figures: DocFigure[] = [{
      file: "getting-started.js",
      figid: "boot",
      type: "flow",
      title: "First launch",
      caption: "The first-run path.",
      svg: "docs/generated/figures/getting-started__boot.svg",
      w: 800,
      h: 160,
    }];
    const raw = [
      "---",
      "id: guide/getting-started",
      "---",
      "# Get started",
      "",
      "See [the shell](../reference/ui.md#dock).",
      "",
      "@fig boot",
      "",
      "![The Dock](../media/shot-dock.png)",
    ].join("\n");
    const segments = prepareDocSegments(raw, docs[0]!, docs, figures);

    expect(segments[0]).toMatchObject({ kind: "markdown" });
    expect(segments.map((segment) => segment.kind)).toEqual(["markdown", "asset", "asset"]);
    expect(segments[0]?.kind === "markdown" && segments[0].body).toContain(
      "](/docs/reference%2Fui#dock)",
    );
    expect(segments[1]).toMatchObject({
      kind: "asset",
      path: "docs/generated/figures/getting-started__boot.svg",
    });
    expect(segments[2]).toMatchObject({ kind: "asset", path: "docs/media/shot-dock.png" });
  });

  test("recognizes only in-app docs links", () => {
    expect(targetFromAppHref("/docs/reference%2Fui#dock")).toEqual({ id: "reference/ui", anchor: "dock" });
    expect(targetFromAppHref("https://example.com")).toBeNull();
  });
});
