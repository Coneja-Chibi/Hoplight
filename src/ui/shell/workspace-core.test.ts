/**
 * Restoring the bench after a restart.
 *
 * The rules that matter are about what is NOT restored: content, and pieces that no longer exist.
 * Both failures look like the feature working right up until somebody notices they are editing a
 * version of their work from an hour ago, or staring at tabs that will not open.
 */
import { describe, expect, test } from "bun:test";
import { liveRefs, readWorkspace, snapshotWorkspace, workspaceKey } from "./workspace-core";

const piece = (kind: string, id: string, focusEntry?: string) => ({
  kind, id, name: id, ...(focusEntry ? { params: { focusEntry } } : {}),
});

describe("snapshotWorkspace", () => {
  test("IT STORES REFERENCES, NEVER CONTENT", () => {
    /**
     * A snapshot holding the pieces themselves would be a second copy of the studio, stale the
     * moment anything else writes - and restoring from it would quietly resurrect an old version of
     * somebody's work. What comes back is which pieces were open; they are re-read from disk.
     */
    const snap = snapshotWorkspace({
      pieces: [{ ...piece("preset", "astrolabe"), name: "Astrolabe", body: { secret: 1 } } as never],
      activeKey: "preset:astrolabe",
      splitKey: "",
      appId: "workbench",
    });
    const text = JSON.stringify(snap);
    expect(text).not.toContain("secret");
    expect(text).not.toContain("body");
    expect(snap.open).toEqual([{ kind: "preset", id: "astrolabe" }]);
  });

  test("the entry a lorebook was open on survives", () => {
    // The same book can be open twice on different entries; without this they restore as one tab.
    const snap = snapshotWorkspace({
      pieces: [piece("lorebook", "harbor", "docks")],
      activeKey: "", splitKey: "", appId: "workbench",
    });
    expect(snap.open[0]?.focusEntry).toBe("docks");
  });

  test("bounded, so a session with a hundred tabs cannot bloat the settings file", () => {
    const many = Array.from({ length: 200 }, (_, i) => piece("preset", `p${String(i)}`));
    expect(snapshotWorkspace({ pieces: many, activeKey: "", splitKey: "", appId: "" }).open.length)
      .toBeLessThanOrEqual(40);
  });
});

describe("readWorkspace", () => {
  test("a record written by another build does not stop the app starting", () => {
    // Written by one version and read by the next. A changed field should cost a tab layout, never
    // the ability to open the studio.
    for (const junk of [null, "workspace", 3, [], { open: "no" }, { open: [{ kind: 1 }] }]) {
      const got = readWorkspace(junk);
      expect(got === null || Array.isArray(got.open)).toBe(true);
    }
  });

  test("a good record round-trips", () => {
    const snap = snapshotWorkspace({
      pieces: [piece("preset", "astrolabe"), piece("lorebook", "harbor", "docks")],
      activeKey: "preset:astrolabe", splitKey: "lorebook:harbor@docks", appId: "workbench",
    });
    expect(readWorkspace(JSON.parse(JSON.stringify(snap)))).toEqual(snap);
  });
});

describe("liveRefs", () => {
  test("A PIECE DELETED SINCE IS DROPPED, and the rest still restore", () => {
    /**
     * The two wrong answers are restoring it as a tab that cannot open, and refusing the whole
     * restore because one of twenty is gone. Neither is what somebody wanted when they asked to
     * come back to where they were.
     */
    const snap = snapshotWorkspace({
      pieces: [piece("preset", "astrolabe"), piece("preset", "deleted"), piece("preset", "clean")],
      activeKey: "", splitKey: "", appId: "workbench",
    });
    const studio = [piece("preset", "astrolabe"), piece("preset", "clean")];

    const live = liveRefs(snap, studio);
    expect(live.map((p) => p.id)).toEqual(["astrolabe", "clean"]);
  });

  test("kind and id both, so two pieces sharing an id do not swap", () => {
    const snap = snapshotWorkspace({
      pieces: [piece("character", "astrolabe")], activeKey: "", splitKey: "", appId: "",
    });
    expect(liveRefs(snap, [piece("preset", "astrolabe")])).toHaveLength(0);
  });
});

describe("workspaceKey", () => {
  test("IT ONLY CHANGES WHEN THE BENCH DOES", () => {
    /**
     * The store rebuilds these objects on every write, so identity says nothing. Without a value
     * key, every status-bar message would rewrite the settings file.
     */
    const a = snapshotWorkspace({
      pieces: [piece("preset", "astrolabe")], activeKey: "preset:astrolabe", splitKey: "", appId: "workbench",
    });
    const b = snapshotWorkspace({
      pieces: [piece("preset", "astrolabe")], activeKey: "preset:astrolabe", splitKey: "", appId: "workbench",
    });
    expect(workspaceKey(a)).toBe(workspaceKey(b));

    const moved = snapshotWorkspace({
      pieces: [piece("preset", "astrolabe")], activeKey: "", splitKey: "", appId: "workbench",
    });
    expect(workspaceKey(moved)).not.toBe(workspaceKey(a));
  });
});
