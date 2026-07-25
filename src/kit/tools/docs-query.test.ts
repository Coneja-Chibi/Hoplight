/**
 * Contract tests for Kit's bounded read-only Hoplight documentation tool.
 */
import { describe, expect, test } from "bun:test";
import type { KitBridge } from "../bridge";
import type { HoplightDocs } from "../docs/repository";
import { createDocsQueryTool } from "./docs-query";

const bridge = {
  studioDir: "/fake",
  async deckCounts() { return []; },
  async list() { return []; },
  async read() { return null; },
  async save() { throw new Error("not used"); },
  async delete() { return false; },
} satisfies KitBridge;

const docs = {
  async browse(options) {
    if (options?.collection?.includes("..")) return null;
    if (options?.collection === "guide") {
      return {
        collection: "guide",
        collections: [{ id: "guide/platforms", pageCount: 1 }],
        pages: [{
          id: "guide/getting-started",
          title: "Get started",
          audience: "user",
          summary: "Install and import.",
          semanticSummary: "Full install and first-import overview.",
          topics: ["install", "first import"],
        }],
        totalPages: 1,
        offset: options.offset ?? 0,
        limit: options.limit ?? 12,
      };
    }
    return {
      collection: null,
      collections: [{ id: "guide", pageCount: 3 }, { id: "reference", pageCount: 2 }],
      pages: [{
        id: "01-VISION",
        title: "Vision",
        audience: "dev",
        summary: "Product intent.",
        semanticSummary: "Founding product vision.",
        topics: ["product vision"],
      }],
      totalPages: 1,
      offset: options?.offset ?? 0,
      limit: options?.limit ?? 12,
    };
  },
  async outline(id) {
    if (id !== "reference/security/remote-access") return null;
    return {
      id,
      title: "Remote access",
      audience: "dev",
      summary: "Tailscale and LAN gates.",
      semanticSummary: "Remote access trust boundary and LAN approval flow.",
      topics: ["remote access", "lan gate"],
      sections: [{
        text: "The LAN gate",
        slug: "the-lan-gate",
        level: 2 as const,
        summary: "Owner approval is required.",
        topics: ["approval"],
        children: [{
          text: "Pairing phrase",
          slug: "pairing-phrase",
          level: 3 as const,
          summary: "The owner reads a short pairing phrase.",
          topics: ["pairing"],
          children: [],
        }],
      }],
    };
  },
  async search(query) {
    return query === "remote"
      ? [{
          id: "reference/security/remote-access",
          title: "Remote access",
          audience: "dev",
          summary: "Tailscale and LAN gates.",
          anchors: [{
            text: "The LAN gate",
            slug: "the-lan-gate",
            level: 2 as const,
            summary: "",
            topics: [],
            children: [],
          }],
        }]
      : [];
  },
  async read(id, options) {
    if (id !== "reference/security/remote-access") return null;
    const section = options?.section;
    const offset = options?.offset ?? 0;
    return {
      id,
      title: "Remote access",
      section: section ?? null,
      body: section ? "## The LAN gate\n\nApproval is required." : "# Remote access",
      truncated: false,
      offset,
      nextOffset: null,
      totalChars: 15,
      anchors: [{
        text: "The LAN gate",
        slug: "the-lan-gate",
        level: 2 as const,
        summary: "",
        topics: [],
        children: [],
      }],
    };
  },
} satisfies HoplightDocs;

const tool = createDocsQueryTool();
const ctx = { bridge, docs };

describe("docs_query", () => {
  test("searches the catalog without reading arbitrary paths", async () => {
    const result = await tool.execute({ action: "search", query: "remote" }, ctx);
    expect(result.summary).toBe('docs search "remote": 1');
    expect(result.output).toContain("reference/security/remote-access");
    expect(result.output).toContain("the-lan-gate");
    expect(result.output).toContain("navigation aids");
  });

  test("browses root and named collections from metadata only", async () => {
    const root = await tool.execute({ action: "browse" }, ctx);
    expect(root.summary).toContain("docs browse root");
    expect(root.output).toContain("collection guide");
    expect(root.output).toContain("01-VISION");

    const guide = await tool.execute({ action: "browse", collection: "guide" }, ctx);
    expect(guide.summary).toContain("docs browse guide");
    expect(guide.output).toContain("guide/getting-started");
    expect(guide.output).toContain("Full install and first-import overview.");
    expect(guide.output).toContain("navigation aids");
  });

  test("outlines one page as a collapsed H2 map by default", async () => {
    const result = await tool.execute({
      action: "outline",
      id: "reference/security/remote-access",
    }, ctx);
    expect(result.summary).toBe("docs outline reference/security/remote-access");
    expect(result.output).toContain("the-lan-gate");
    expect(result.output).toContain("1 child section");
    expect(result.output).not.toContain("Owner approval is required.");
    expect(result.output).not.toContain("The owner reads a short pairing phrase.");
    expect(result.output).toContain("navigation aids");
  });

  test("expands one selected outline branch", async () => {
    const result = await tool.execute({
      action: "outline",
      id: "reference/security/remote-access",
      section: "the-lan-gate",
    }, ctx);
    expect(result.summary).toContain("#the-lan-gate");
    expect(result.output).toContain("Owner approval is required.");
    expect(result.output).toContain("The owner reads a short pairing phrase.");
  });

  test("reads either one nugget or a whole document", async () => {
    const result = await tool.execute({
      action: "read",
      id: "reference/security/remote-access",
      section: "the-lan-gate",
    }, ctx);
    expect(result.summary).toBe("docs read reference/security/remote-access#the-lan-gate");
    expect(result.output).toContain("Approval is required.");

    const whole = await tool.execute({
      action: "read",
      id: "reference/security/remote-access",
    }, ctx);
    expect(whole.output).toContain("# Remote access");
    expect(whole.output).toContain("whole document");
  });

  test("fails closed when the docs corpus is unavailable", async () => {
    const result = await tool.execute({ action: "search", query: "remote" }, { bridge });
    expect(result.summary).toBe("docs unavailable");
  });

  test("rejects empty searches, path-like read ids, and path-escape collections", () => {
    expect(tool.input.safeParse({ action: "search", query: "" }).success).toBe(false);
    expect(tool.input.safeParse({ action: "read", id: "../SECURITY" }).success).toBe(false);
    expect(tool.input.safeParse({ action: "browse", collection: "../SECURITY" }).success).toBe(false);
    expect(tool.input.safeParse({ action: "browse", collection: "guide/../secret" }).success).toBe(false);
    expect(tool.input.safeParse({ action: "browse", limit: 26 }).success).toBe(false);
    expect(tool.input.safeParse({ action: "outline", id: "reference/security/remote-access" }).success)
      .toBe(true);
    expect(tool.input.safeParse({
      action: "outline",
      id: "reference/security/remote-access",
      section: "the-lan-gate",
    }).success).toBe(true);
    expect(tool.input.safeParse({
      action: "read",
      id: "reference/security/remote-access",
      offset: 1_000,
    }).success).toBe(true);
  });

  test("outline fails closed for unknown ids", async () => {
    const result = await tool.execute({ action: "outline", id: "missing/page" }, ctx);
    expect(result.summary).toBe("docs outline missing/page: not found");
  });

  test("outline fails closed for an unknown section", async () => {
    const result = await tool.execute({
      action: "outline",
      id: "reference/security/remote-access",
      section: "missing-section",
    }, ctx);
    expect(result.summary).toContain("missing-section: not found");
  });
});
