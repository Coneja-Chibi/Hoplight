/** Verifies composer history recall and restoration of an unsent draft. */
import { describe, expect, test } from "bun:test";
import { commit, initRecall, recallNext, recallPrev } from "./recall";

describe("recall", () => {
  test("empty ring: up returns the live text unchanged", () => {
    expect(recallPrev(initRecall(), "typing")).toEqual({ state: initRecall(), text: "typing" });
  });

  test("commit adds to the ring, skips empty and exact-repeat-of-newest", () => {
    let s = commit(initRecall(), "one");
    s = commit(s, "two");
    s = commit(s, "   "); // empty (whitespace) skipped
    s = commit(s, "two"); // exact repeat of newest skipped
    expect(s.ring).toEqual(["one", "two"]);
    expect(s.index).toBeNull();
  });

  test("up stashes the live draft and walks older entries, clamping at the oldest", () => {
    let s = commit(commit(initRecall(), "one"), "two");
    let r = recallPrev(s, "draft"); // enter history from live
    expect(r.text).toBe("two");
    expect(r.state.stash).toBe("draft");
    r = recallPrev(r.state, "ignored"); // older
    expect(r.text).toBe("one");
    r = recallPrev(r.state, "ignored"); // clamp at oldest
    expect(r.text).toBe("one");
  });

  test("down walks newer, and past the newest restores the stashed draft (the ghost)", () => {
    const s = commit(commit(initRecall(), "one"), "two");
    const up = recallPrev(s, "my draft"); // -> "two", stash "my draft"
    const back = recallNext(up.state); // past newest -> restore ghost
    expect(back.text).toBe("my draft");
    expect(back.state.index).toBeNull();
  });

  test("down while already live returns the (empty) stash without error", () => {
    const s = commit(initRecall(), "one");
    expect(recallNext(s).text).toBe("");
  });
});
