/**
 * Where a staged batch goes, which is a routing decision and not a rendering one.
 *
 * The rule worth pinning: a kind the Workbench cannot edit must not be sent there. A drawing
 * arriving on the Workbench opens a tab that shows nothing, and a piece that appears to open and
 * then draws nothing reads as broken content rather than as a missing editor.
 */
import { describe, expect, test } from "bun:test";
import { routeSend, sendStatus } from "./send-pieces";
import type { StudioEntitySummary } from "../../app-contract";

const piece = (kind: string, id: string): StudioEntitySummary =>
  ({ kind, id, name: id } as StudioEntitySummary);

describe("routeSend", () => {
  test("sends ordinary pieces to the Workbench and nothing to the viewer", () => {
    const out = routeSend([piece("character", "a"), piece("preset", "b")]);
    expect(out.toWorkbench.map((p) => p.id)).toEqual(["a", "b"]);
    expect(out.toViewer).toBeNull();
    expect(sendStatus(out)).toBeNull();
  });

  test("keeps a drawing away from the Workbench entirely", () => {
    const out = routeSend([piece("htmldoc", "wire")]);
    expect(out.toWorkbench).toEqual([]);
    expect(out.toViewer?.id).toBe("wire");
  });

  test("splits a mixed batch so neither destination loses a piece", () => {
    const out = routeSend([piece("character", "a"), piece("htmldoc", "wire"), piece("regex", "r")]);
    expect(out.toWorkbench.map((p) => p.id)).toEqual(["a", "r"]);
    expect(out.toViewer?.id).toBe("wire");
    expect(out.deferred).toBe(0);
  });

  /** The viewer draws one page, so the rest are staged and NOT silently dropped from the count. */
  test("opens one drawing and reports how many it did not", () => {
    const out = routeSend([piece("htmldoc", "one"), piece("htmldoc", "two"), piece("htmldoc", "three")]);
    expect(out.toViewer?.id).toBe("one");
    expect(out.deferred).toBe(2);
    expect(sendStatus(out)).toContain("2 more");
  });

  test("an empty batch routes nowhere and says nothing", () => {
    const out = routeSend([]);
    expect(out.toWorkbench).toEqual([]);
    expect(out.toViewer).toBeNull();
    expect(sendStatus(out)).toBeNull();
  });
});
