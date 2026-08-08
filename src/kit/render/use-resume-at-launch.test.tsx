/** @jsxImportSource @opentui/react */
/**
 * `kit -r`, at the seam where it decides what to open.
 *
 * The cases worth pinning are the ones where there is nothing to resume: a launch flag must never be
 * able to stop Kit from opening, and a blank screen after `kit -r` is indistinguishable from a flag
 * that does not work.
 */
import { describe, expect, test } from "bun:test";
import type { ReactNode } from "react";
import { settleRender, testRender } from "./test-render";
import { useResumeAtLaunch, type ResumeRequest } from "./use-resume-at-launch";

/** A stub of just the two actions this hook reaches for, plus a record of what it did. */
const actionsWith = (over: Record<string, unknown> = {}) => {
  const opened: string[] = [];
  let listed = 0;
  const actions = {
    list: async () => { listed += 1; return [{ id: "newest" }, { id: "older" }]; },
    open: async (id: string) => { opened.push(id); },
    ...over,
  } as never;
  return { actions, opened, listedCount: () => listed };
};

/** Mounts the hook and lets its effect run to completion. */
async function run(
  request: ResumeRequest | undefined,
  actions: never,
  said: string[],
): Promise<() => Promise<void>> {
  function Harness(): ReactNode {
    useResumeAtLaunch(request, actions, (text) => { said.push(text); });
    return <text>mounted</text>;
  }
  const setup = await testRender(<Harness />, { width: 40, height: 6 });
  await settleRender();
  return () => setup.renderer.destroy();
}

describe("useResumeAtLaunch", () => {
  test("no request opens nothing", async () => {
    const { actions, opened } = actionsWith();
    const said: string[] = [];
    const close = await run(undefined, actions, said);
    try {
      expect(opened).toEqual([]);
      expect(said).toEqual([]);
    } finally { await close(); }
  });

  test("true opens the most recent", async () => {
    // The store lists newest first, which is the whole of how "most recent" is decided.
    const { actions, opened } = actionsWith();
    const close = await run(true, actions, []);
    try {
      expect(opened).toEqual(["newest"]);
    } finally { await close(); }
  });

  test("a name opens that one without listing", async () => {
    const { actions, opened, listedCount } = actionsWith();
    const close = await run("abc123", actions, []);
    try {
      expect(opened).toEqual(["abc123"]);
      expect(listedCount()).toBe(0);
    } finally { await close(); }
  });

  test("nothing saved yet says so instead of showing a blank screen", async () => {
    const said: string[] = [];
    const { actions, opened } = actionsWith({ list: async () => [] });
    const close = await run(true, actions, said);
    try {
      expect(opened).toEqual([]);
      expect(said.join(" ")).toContain("No saved sessions");
    } finally { await close(); }
  });

  test("a failure to open still leaves Kit running, and says why", async () => {
    // A launch flag must never be the reason the app does not come up.
    const said: string[] = [];
    const { actions } = actionsWith({ open: async () => { throw new Error("corrupt"); } });
    const close = await run(true, actions, said);
    try {
      expect(said.join(" ")).toContain("Could not resume");
    } finally { await close(); }
  });

  test("it resumes once, not on every render", async () => {
    // `open` swaps the whole transcript and re-renders; a resume that re-fired on its own output
    // would fight anybody who started a fresh session afterwards.
    const { actions, opened } = actionsWith();
    const close = await run(true, actions, []);
    try {
      await settleRender();
      await settleRender();
      expect(opened).toEqual(["newest"]);
    } finally { await close(); }
  });
});
