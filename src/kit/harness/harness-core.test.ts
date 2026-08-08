/**
 * What Kit is allowed to write about itself.
 *
 * A self-edit is the one write whose blast radius is every future session, so the tests here are
 * mostly about REFUSAL: what cannot be proposed, and what a proposal has to say for itself before a
 * person can be asked to accept it.
 */
import { describe, expect, test } from "bun:test";
import {
  applyProposal, emptyHarness, MAX_CONTENT, MAX_ENTRIES, refuseProposal,
  type HarnessProposal, type HarnessState,
} from "./harness-core";

const NOW = "2026-08-06T10:00:00.000Z";

const propose = (over: Partial<HarnessProposal> = {}): HarnessProposal => ({
  action: "create",
  kind: "memory",
  title: "Chi skims long replies",
  content: "Lead with the decision; put the evidence in a file.",
  evidence: "Said so directly, twice, in this session.",
  ...over,
});

const withEntry = (over: Partial<HarnessState["entries"][number]> = {}): HarnessState => ({
  schema: 1,
  entries: [{
    id: "e1", kind: "memory", title: "A thing", content: "the body",
    scope: "local", version: 1, createdAt: NOW, updatedAt: NOW, ...over,
  }],
});

describe("refuseProposal", () => {
  test("a well-formed create is allowed", () => {
    expect(refuseProposal(emptyHarness(), propose())).toBeNull();
  });

  test("no evidence, no review", () => {
    // The review card is BUILT from the evidence, so a proposal that cannot justify itself cannot
    // be shown to anybody, and therefore cannot be accepted.
    expect(refuseProposal(emptyHarness(), propose({ evidence: "   " }))).toContain("No evidence");
  });

  test("a kind nothing defines is refused, not invented", () => {
    expect(refuseProposal(emptyHarness(), propose({ kind: "vibes" }))).toContain("vibes");
  });

  test("a create needs a title and a body", () => {
    expect(refuseProposal(emptyHarness(), propose({ title: "  " }))).toContain("title");
    expect(refuseProposal(emptyHarness(), propose({ content: "" }))).toContain("something in it");
  });

  test("an entry longer than the cap is refused", () => {
    // Past this it is not a note, it is a document, and it will be in every future session.
    const refusal = refuseProposal(emptyHarness(), propose({ content: "x".repeat(MAX_CONTENT + 1) }));
    expect(refusal).toContain(String(MAX_CONTENT));
  });

  test("a full scope refuses rather than growing forever", () => {
    // Unbounded memory is context bloat wearing a costume.
    const full: HarnessState = {
      schema: 1,
      entries: Array.from({ length: MAX_ENTRIES }, (_, i) => ({
        id: `e${String(i)}`, kind: "memory", title: "t", content: "c",
        scope: "local" as const, version: 1, createdAt: NOW, updatedAt: NOW,
      })),
    };
    expect(refuseProposal(full, propose())).toContain("has to go first");
  });

  test("updating something that is not there is refused", () => {
    expect(refuseProposal(emptyHarness(), propose({ action: "update", id: "nope", content: "x" })))
      .toContain("no entry");
  });

  test("deleting something that is not there is refused", () => {
    expect(refuseProposal(emptyHarness(), propose({ action: "delete", id: "nope" }))).toContain("no entry");
  });

  test("an update that changes nothing is refused", () => {
    // The same no-op that made the rail report a pending change it could not apply.
    const refusal = refuseProposal(withEntry(), propose({ action: "update", id: "e1", content: "the body", title: "A thing" }));
    expect(refusal).toContain("already says");
  });

  test("an update with no new content is refused", () => {
    expect(refuseProposal(withEntry(), propose({ action: "update", id: "e1", content: "  " })))
      .toContain("change nothing");
  });
});

describe("applyProposal", () => {
  test("a create lands with version 1 and both timestamps", () => {
    const { state, changes } = applyProposal(emptyHarness(), propose(), NOW, "new-1");
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]).toMatchObject({
      id: "new-1", kind: "memory", version: 1, createdAt: NOW, updatedAt: NOW, scope: "local",
    });
    expect(changes[0]).toContain("added memory");
  });

  test("scope defaults to local, because global follows you everywhere", () => {
    const { state } = applyProposal(emptyHarness(), propose(), NOW, "n");
    expect(state.entries[0]?.scope).toBe("local");
    const { state: g } = applyProposal(emptyHarness(), propose({ scope: "global" }), NOW, "n");
    expect(g.entries[0]?.scope).toBe("global");
  });

  test("an update bumps the version and says what changed", () => {
    // The version is what a rollback names, so it has to move on every accepted edit.
    const later = "2026-08-07T00:00:00.000Z";
    const { state, changes } = applyProposal(
      withEntry(), propose({ action: "update", id: "e1", content: "a new body" }), later, "unused",
    );
    expect(state.entries[0]).toMatchObject({ version: 2, updatedAt: later, createdAt: NOW });
    expect(changes.join(" ")).toContain("rewrote");
  });

  test("a rename is reported separately from a rewrite", () => {
    const { changes } = applyProposal(
      withEntry(), propose({ action: "update", id: "e1", title: "Renamed", content: "a new body" }), NOW, "u",
    );
    expect(changes.join(" ")).toContain("renamed to");
    expect(changes.join(" ")).toContain("rewrote");
  });

  test("a delete removes exactly one and names it", () => {
    const { state, changes } = applyProposal(withEntry(), propose({ action: "delete", id: "e1" }), NOW, "u");
    expect(state.entries).toHaveLength(0);
    expect(changes[0]).toContain("A thing");
  });

  test("nothing else in the state is disturbed", () => {
    // A self-edit that quietly touched a neighbouring entry would be the worst possible bug here.
    const two: HarnessState = {
      schema: 1,
      entries: [...withEntry().entries, {
        id: "e2", kind: "skill", title: "Other", content: "untouched",
        scope: "global", version: 3, createdAt: NOW, updatedAt: NOW,
      }],
    };
    const { state } = applyProposal(two, propose({ action: "update", id: "e1", content: "changed" }), NOW, "u");
    expect(state.entries.find((e) => e.id === "e2")).toEqual(two.entries[1]!);
  });
});
