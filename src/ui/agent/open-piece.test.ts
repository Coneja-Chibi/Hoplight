/**
 * Turning a mentioned piece into a tab.
 *
 * The marker exists so a click cannot land on the wrong piece. These pin that: exact kind and id,
 * never a name, and a marker naming something deleted since it was written reports rather than
 * quietly doing nothing.
 */
import { describe, expect, test } from "bun:test";
import { openMentioned, pieceFor, readMarker } from "./open-piece";
import type { AppContext, StudioEntitySummary } from "../app-contract";

const piece = (kind: string, id: string, name: string): StudioEntitySummary => ({ kind, id, name });

const PIECES = [
  piece("preset", "astrolabe", "Astrolabe"),
  piece("character", "astrolabe", "Astrolabe"),
  piece("preset", "clean", "Clean"),
];

describe("readMarker", () => {
  test("it reads what the composer wrote", () => {
    expect(readMarker("@preset:astrolabe")).toEqual({ kind: "preset", id: "astrolabe" });
    expect(readMarker("@character:ludovic-and-levi"))
      .toEqual({ kind: "character", id: "ludovic-and-levi" });
  });

  test("ORDINARY WORDS ARE NOT MARKERS", () => {
    // This runs over every word of every transcript line. Anything looser would turn an email
    // address or a stray at-sign into a link to nothing.
    for (const word of ["astrolabe", "@astrolabe", "you@example.com", "@", "@preset:", "@:id", ""]) {
      expect(readMarker(word)).toBeNull();
    }
  });
});

describe("pieceFor", () => {
  test("KIND AND ID BOTH, because an id alone is not unique", () => {
    /**
     * A preset and a character can share an id - they live in different folders. Matching on id
     * alone would open whichever came first in the list, which is the exact ambiguity the marker
     * was written to remove.
     */
    expect(pieceFor({ kind: "character", id: "astrolabe" }, PIECES)?.kind).toBe("character");
    expect(pieceFor({ kind: "preset", id: "astrolabe" }, PIECES)?.kind).toBe("preset");
  });

  test("a piece that is gone resolves to nothing", () => {
    expect(pieceFor({ kind: "preset", id: "deleted" }, PIECES)).toBeNull();
  });
});

describe("openMentioned", () => {
  test("it opens the piece and goes to the bench", () => {
    const opened: StudioEntitySummary[] = [];
    const apps: string[] = [];
    const ctx = {
      workbench: { open: (p: StudioEntitySummary) => opened.push(p) },
      openApp: (id: string) => apps.push(id),
    } as unknown as AppContext;

    expect(openMentioned(ctx, { kind: "preset", id: "clean" }, PIECES)).toBe(true);
    expect(opened[0]?.id).toBe("clean");
    // Opening without navigating would put it on a bench nobody is looking at.
    expect(apps).toContain("workbench");
  });

  test("A DELETED PIECE REPORTS RATHER THAN DOING NOTHING", () => {
    /**
     * A conversation outlives the studio it is about. A link that silently does nothing when
     * pressed is read as the app being broken; the caller needs the false to say what happened.
     */
    const opened: StudioEntitySummary[] = [];
    const ctx = {
      workbench: { open: (p: StudioEntitySummary) => opened.push(p) },
      openApp: () => undefined,
    } as unknown as AppContext;

    expect(openMentioned(ctx, { kind: "preset", id: "gone" }, PIECES)).toBe(false);
    expect(opened).toHaveLength(0);
  });
});
