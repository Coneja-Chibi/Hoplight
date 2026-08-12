/**
 * Editing a drawing that already exists.
 *
 * THE DEFECT THIS CLOSES, verbatim from the agent that hit it: "the available HTML operation only
 * exposes Create, not Edit, and refused to overwrite the existing focused ID. So the ugly document
 * has not changed and no draft is waiting." The refusal was right - create-only apply must not eat
 * an occupied id - and the model was left holding a rewrite with nowhere to put it.
 */
import { describe, expect, test } from "bun:test";
import capability from "./document";
import type { CanonicalHtmlDoc } from "../schema";

const drawing = (): CanonicalHtmlDoc => ({
  schemaVersion: "1",
  kind: "htmldoc",
  id: "astrolabe-01",
  body: {
    name: "Astrolabe 01",
    html: "<div class=\"ugly\">before</div>",
    summary: "the first pass",
    tags: ["wireframe"],
  },
} as unknown as CanonicalHtmlDoc);

const run = (patch: Record<string, unknown>) =>
  capability.preview!(drawing(), capability.input.parse({ target: { id: "astrolabe-01" }, patch }));

describe("htmldoc.document.update", () => {
  test("exists at all, as a draft rather than a write", () => {
    // The whole point: an EDIT verb for a kind that only had create.
    expect(capability.id).toBe("htmldoc.document.update");
    expect(capability.action).toBe("update");
    expect(capability.effect).toBe("draft");
  });

  test("rewriting the markup leaves everything else exactly as it was", async () => {
    const result = await run({ html: "<div class=\"clean\">after</div>" });
    expect(result.entity.body.html).toBe("<div class=\"clean\">after</div>");
    expect(result.entity.body.name).toBe("Astrolabe 01");
    expect(result.entity.body.summary).toBe("the first pass");
    expect(result.entity.body.tags).toEqual(["wireframe"]);
    expect(result.changes.map((c) => c.path)).toEqual(["body.html"]);
  });

  test("long markup is shown as a head and a length, so a reviewer can read the row", async () => {
    const long = `<div>${"x".repeat(900)}</div>`;
    const result = await run({ html: long });
    const change = result.changes.find((c) => c.path === "body.html");
    expect(String(change?.after)).toContain("characters)");
    expect(String(change?.after).length).toBeLessThan(500);
    // The ENTITY still carries the whole thing; only the review row is abbreviated.
    expect(result.entity.body.html).toBe(long);
  });

  test("a patch that changes nothing produces no changes and the same entity", async () => {
    const result = await run({ name: "Astrolabe 01" });
    expect(result.changes).toEqual([]);
    expect(result.entity.body).toEqual(drawing().body);
  });

  test("an emptied optional field is removed, not stored as an empty string", async () => {
    const result = await run({ summary: "" });
    expect("summary" in result.entity.body).toBe(false);
  });

  test("markup the seal would strip is warned about, not refused", async () => {
    // Refusing would be this capability deciding what somebody may draw; the Gate is where a
    // person decides, and the warning is what makes that decision informed.
    const result = await run({ html: "<button>Reveal</button>" });
    expect(result.warnings.join(" ")).toContain("button");
    expect(result.entity.body.html).toBe("<button>Reveal</button>");
    expect(result.changes.length).toBe(1);
  });

  test("an empty patch is refused by the schema rather than drafted as a no-op", () => {
    expect(() => capability.input.parse({ target: { id: "astrolabe-01" }, patch: {} })).toThrow();
  });
});
