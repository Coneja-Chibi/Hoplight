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

  test("routes a drawing to the Workbench now that it has an editor there", () => {
    // Drawings were routed away until the Workbench could edit one. Making them pieces was the
    // point; a piece that opens somewhere else forever would only be half of that.
    const out = routeSend([piece("htmldoc", "wire")]);
    expect(out.toWorkbench.map((p) => p.id)).toEqual(["wire"]);
    expect(out.toViewer).toBeNull();
  });

  test("a mixed batch loses nothing", () => {
    const out = routeSend([piece("character", "a"), piece("htmldoc", "wire"), piece("regex", "r")]);
    expect(out.toWorkbench.map((p) => p.id)).toEqual(["a", "wire", "r"]);
    expect(out.toViewer).toBeNull();
    expect(out.deferred).toBe(0);
  });

  /**
   * The rerouted path, proven through the seam rather than through a kind - no kind is rerouted
   * today, and the rule it encodes (one opens, the rest are COUNTED rather than dropped) has to
   * keep working for whichever kind arrives next before its editor does.
   */
  test("when a kind is rerouted, one opens and the rest are counted", () => {
    const out = { toWorkbench: [], toViewer: piece("htmldoc", "one"), deferred: 2 };
    expect(sendStatus(out)).toContain("2 more");
    expect(sendStatus({ ...out, deferred: 0 })).toBe("opened one");
  });

  test("an empty batch routes nowhere and says nothing", () => {
    const out = routeSend([]);
    expect(out.toWorkbench).toEqual([]);
    expect(out.toViewer).toBeNull();
    expect(sendStatus(out)).toBeNull();
  });
});
