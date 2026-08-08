/**
 * Enter, from the rail.
 *
 * This is a write path, so the tests are mostly about what does NOT happen: no confirm means no
 * write, a denial means no write and no lost work, and a stale revision means no write and a person
 * told why. The one thing that must happen is that the confirmation is asked for at all.
 */
import { describe, expect, test } from "bun:test";
import { commitRail, type CommitDeps } from "./commit-rail";
import type { OutlineRow } from "../../../core/preset/outline";
import type { ChangeReceipt } from "../../changes/types";
import type { GateRequest } from "../../tools/safety/gated-dispatch";

const rows: OutlineRow[] = [
  { index: 0, id: "a", name: "A", enabled: true, marker: false, size: 4, role: "system" },
];

const review = {
  draftId: "draft-1",
  target: { kind: "preset" as const, id: "p" },
  changes: [{ label: "block order", before: "as stored", after: "rearranged" }],
  warningCount: 0,
};

const receipt = (status: ChangeReceipt["status"], detail = ""): ChangeReceipt =>
  ({
    draftId: "draft-1",
    target: { ...review.target, revision: "r1" },
    status, operationCount: 1, changeCount: 1, detail,
  });

const deps = (over: Partial<CommitDeps> = {}) => {
  const said: string[] = [];
  const seen: GateRequest[] = [];
  let commits = 0;
  const discarded: string[] = [];
  const base: CommitDeps = {
    stage: async () => ({ ok: true, draftId: "draft-1", review }),
    commit: async () => { commits += 1; return receipt("applied"); },
    discard: (id) => void discarded.push(id),
    confirm: async (request) => { seen.push(request); return { type: "allow-once" }; },
    say: (text) => void said.push(text),
    ...over,
  };
  return { deps: base, said, seen, discarded, commits: () => commits };
};

describe("commitRail", () => {
  test("a confirmed edit is staged, asked about, then applied exactly once", async () => {
    const harness = deps();
    const outcome = await commitRail("p", rows, harness.deps);
    expect(outcome.applied).toBe(true);
    expect(harness.seen).toHaveLength(1);
    expect(harness.commits()).toBe(1);
    expect(harness.said.join(" ")).toContain("Applied to p");
  });

  test("the confirmation carries the review, so the Gate shows the change not the tool", () => {
    const harness = deps();
    return commitRail("p", rows, harness.deps).then(() => {
      expect(harness.seen[0]!.review).toBe(review);
      expect(harness.seen[0]!.verdict.level).toBe("caution");
      expect(harness.seen[0]!.peek.detail).toBe("p");
    });
  });

  test("a denial writes nothing and says the edits are still there", async () => {
    // Throwing away a session of rearranging because of one keystroke would be the wrong reading.
    const harness = deps({ confirm: async () => ({ type: "deny" }) });
    const outcome = await commitRail("p", rows, harness.deps);
    expect(outcome.applied).toBe(false);
    expect(harness.commits()).toBe(0);
    expect(harness.said.join(" ")).toContain("still in the rail");
  });

  test("holding the confirm is not consent, so nothing is written", async () => {
    const harness = deps({ confirm: async () => ({ type: "hold" }) });
    expect((await commitRail("p", rows, harness.deps)).applied).toBe(false);
    expect(harness.commits()).toBe(0);
  });

  test("an abort writes nothing", async () => {
    const harness = deps({ confirm: async () => ({ type: "abort" }) });
    expect((await commitRail("p", rows, harness.deps)).applied).toBe(false);
    expect(harness.commits()).toBe(0);
  });

  test("a refusal to stage never reaches the confirm", async () => {
    // Nothing to apply, or a rail out of step with storage. Asking about a write that cannot happen
    // trains people to dismiss the prompt.
    const harness = deps({ stage: async () => ({ ok: false, detail: "Nothing to apply." }) });
    const outcome = await commitRail("p", rows, harness.deps);
    expect(outcome.applied).toBe(false);
    expect(harness.seen).toHaveLength(0);
    expect(harness.commits()).toBe(0);
    expect(harness.said.join(" ")).toContain("Nothing to apply");
  });

  test("a stale revision is named as that, not as a generic failure", async () => {
    // Stale and failed lead to different next moves: reopen, versus something is wrong.
    const harness = deps({ commit: async () => receipt("stale") });
    const outcome = await commitRail("p", rows, harness.deps);
    expect(outcome.applied).toBe(false);
    expect(harness.said.join(" ")).toContain("changed underneath");
    expect(harness.said.join(" ")).toContain("Reopen");
  });

  test("a failed apply reports the receipt's own reason", async () => {
    const harness = deps({ commit: async () => receipt("failed", "disk was full") });
    await commitRail("p", rows, harness.deps);
    expect(harness.said.join(" ")).toContain("disk was full");
  });

  test("allowing for the session counts as consent, like everywhere else", async () => {
    const harness = deps({ confirm: async () => ({ type: "allow-session" }) });
    expect((await commitRail("p", rows, harness.deps)).applied).toBe(true);
    expect(harness.commits()).toBe(1);
  });
});

describe("the staged draft is never left behind", () => {
  // Found live: deny, edit again, press enter, and the change session throws because it still holds
  // an active draft for that piece. One refusal would break every later attempt until restart.
  test("a denial discards the draft, so the next attempt can stage a fresh one", async () => {
    const harness = deps({ confirm: async () => ({ type: "deny" }) });
    await commitRail("p", rows, harness.deps);
    expect(harness.discarded).toEqual(["draft-1"]);
  });

  test("a hold and an abort discard it too", async () => {
    for (const type of ["hold", "abort"] as const) {
      const harness = deps({ confirm: async () => ({ type }) });
      await commitRail("p", rows, harness.deps);
      expect(harness.discarded).toEqual(["draft-1"]);
    }
  });

  test("a stale or failed apply discards it", async () => {
    for (const status of ["stale", "failed"] as const) {
      const harness = deps({ commit: async () => receipt(status) });
      await commitRail("p", rows, harness.deps);
      expect(harness.discarded).toEqual(["draft-1"]);
    }
  });

  test("a successful apply does NOT discard, because apply already retired it", async () => {
    const harness = deps();
    await commitRail("p", rows, harness.deps);
    expect(harness.discarded).toEqual([]);
  });
});

describe("the rename and the note reach the stage call", () => {
  /**
   * This is the link that was broken, and it was invisible from either end: the rail knew about the
   * rename, `session.presets.stage` handled one correctly when called directly, and commitRail sat in
   * between accepting `meta` and passing `stage(id, rows)` without it. A staged rename therefore came
   * back "Nothing to apply", which was literally true and completely misleading.
   *
   * Testing the seam underneath is what let it hide, so this tests the door somebody actually uses.
   */
  test("meta is handed to stage, not dropped", async () => {
    let sawMeta: unknown = "never called";
    const deps = {
      stage: async (_id: string, _rows: readonly OutlineRow[], meta?: unknown) => {
        sawMeta = meta;
        return { ok: false as const, detail: "stop here" };
      },
      commit: async () => ({ status: "applied" }) as never,
      discard: () => {},
      confirm: async () => "allow" as never,
      say: () => {},
    };

    await commitRail("p1", [], deps as never, { name: "New Title", note: "a note" });
    expect(sawMeta).toEqual({ name: "New Title", note: "a note" });
  });

  test("no meta stays undefined rather than becoming an empty object", async () => {
    // An empty object would read downstream as "a rename to nothing" rather than "no rename".
    let sawMeta: unknown = "never called";
    const deps = {
      stage: async (_id: string, _rows: readonly OutlineRow[], meta?: unknown) => {
        sawMeta = meta;
        return { ok: false as const, detail: "stop here" };
      },
      commit: async () => ({ status: "applied" }) as never,
      discard: () => {},
      confirm: async () => "allow" as never,
      say: () => {},
    };

    await commitRail("p1", [], deps as never);
    expect(sawMeta).toBeUndefined();
  });
});
