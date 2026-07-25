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
  async search(query) {
    return query === "remote"
      ? [{
          id: "reference/security/remote-access",
          title: "Remote access",
          audience: "dev",
          summary: "Tailscale and LAN gates.",
          anchors: [{ text: "The LAN gate", slug: "the-lan-gate", level: 2 }],
        }]
      : [];
  },
  async read(id, section) {
    if (id !== "reference/security/remote-access") return null;
    return {
      id,
      title: "Remote access",
      section: section ?? null,
      body: section ? "## The LAN gate\n\nApproval is required." : "# Remote access",
      truncated: false,
      anchors: [{ text: "The LAN gate", slug: "the-lan-gate", level: 2 }],
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
  });

  test("reads a catalog id and one optional section", async () => {
    const result = await tool.execute({
      action: "read",
      id: "reference/security/remote-access",
      section: "the-lan-gate",
    }, ctx);
    expect(result.summary).toBe("docs read reference/security/remote-access#the-lan-gate");
    expect(result.output).toContain("Approval is required.");
  });

  test("fails closed when the docs corpus is unavailable", async () => {
    const result = await tool.execute({ action: "search", query: "remote" }, { bridge });
    expect(result.summary).toBe("docs unavailable");
  });

  test("rejects empty searches and path-like read ids", () => {
    expect(tool.input.safeParse({ action: "search", query: "" }).success).toBe(false);
    expect(tool.input.safeParse({ action: "read", id: "../SECURITY" }).success).toBe(false);
  });
});
