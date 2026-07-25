/**
 * Proof for deterministic Hoplight documentation search and bounded section extraction.
 */
import { describe, expect, test } from "bun:test";
import type { DocRecord } from "../../docs/types";
import {
  buildDocChunks,
  extractDocSection,
  searchDocCatalog,
  searchDocChunks,
} from "./catalog";

const a = (
  text: string,
  slug: string,
  level: 2 | 3 = 2,
): DocRecord["anchors"][number] =>
  ({ text, slug, level, summary: "", topics: [], children: [] });

const docs: DocRecord[] = [
  {
    id: "guide/importing",
    path: "docs/guide/importing.md",
    title: "Importing content",
    audience: "user",
    summary: "Bring cards and lorebooks into the Studio.",
    tags: ["import", "cards"],
    related: [],
    semanticSummary: "",
    topics: [],
    anchors: [a("Import a card", "import-a-card"), a("Troubleshooting", "troubleshooting")],
  },
  {
    id: "reference/security/remote-access",
    path: "docs/reference/security/remote-access.md",
    title: "Remote access",
    audience: "dev",
    summary: "Tailscale and LAN gates for another device.",
    tags: ["security", "remote-access", "lan"],
    related: [],
    semanticSummary: "",
    topics: [],
    anchors: [a("The LAN gate", "the-lan-gate")],
  },
];

describe("searchDocCatalog", () => {
  test("ranks exact title and tag matches deterministically", () => {
    expect(searchDocCatalog(docs, "remote access").map((doc) => doc.id)).toEqual([
      "reference/security/remote-access",
    ]);
    expect(searchDocCatalog(docs, "card").map((doc) => doc.id)).toEqual(["guide/importing"]);
  });

  test("filters by audience and caps the requested result count", () => {
    expect(searchDocCatalog(docs, "the", { audience: "user", limit: 1 })).toHaveLength(1);
    expect(searchDocCatalog(docs, "the", { audience: "dev" }).map((doc) => doc.id)).toEqual([
      "reference/security/remote-access",
    ]);
  });

  test("indexes optional semantic summaries and topics when present", () => {
    const withSemantic: DocRecord[] = [
      {
        ...docs[0]!,
        semanticSummary: "Bring platform cards and lorebooks into the local studio safely.",
        topics: ["card import workflow", "lorebook intake"],
      },
      docs[1]!,
    ];
    expect(searchDocCatalog(withSemantic, "lorebook intake").map((doc) => doc.id)).toEqual([
      "guide/importing",
    ]);
    expect(searchDocCatalog(withSemantic, "platform cards").map((doc) => doc.id)).toEqual([
      "guide/importing",
    ]);
  });
});

describe("extractDocSection", () => {
  const markdown = `---
id: guide/importing
---
# Importing content

Opening.

## Import a card

Card steps.

### PNG cards

PNG detail.

## Troubleshooting

Try again.
`;

  test("returns one heading and its descendants", () => {
    expect(extractDocSection(markdown, "import-a-card")).toBe(
      "## Import a card\n\nCard steps.\n\n### PNG cards\n\nPNG detail.",
    );
  });

  test("returns null for an unknown section", () => {
    expect(extractDocSection(markdown, "missing")).toBeNull();
  });
});

describe("full-text chunk search", () => {
  test("finds body concepts absent from catalog metadata and returns the best section", () => {
    const chunks = [
      ...buildDocChunks(docs[0]!, `# Importing content

## Import a card

Choose a file from your computer.
`),
      ...buildDocChunks(docs[1]!, `# Remote access

## The LAN gate

Pending devices require explicit owner approval before Studio content is served.
`),
    ];
    const hits = searchDocChunks(chunks, "pending device owner approval");
    expect(hits[0]?.doc.id).toBe("reference/security/remote-access");
    expect(hits[0]?.section).toBe("the-lan-gate");
    expect(hits[0]?.excerpt).toContain("owner approval");
  });
});
