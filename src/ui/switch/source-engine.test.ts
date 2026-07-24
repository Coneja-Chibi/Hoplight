/** Tests for the source switch orchestration: refuse+name a dirty tree, restore the exact prior ref on
 *  failure, and the happy path. All with a fake GitRunner (no real repo touched). */
import { describe, expect, test } from "bun:test";
import type { GitRunner } from "./git-runner";
import { sourceSwitch } from "./source-engine";

interface FakeOpts {
  dirty?: string[];
  tagExists?: boolean;
  failCheckout?: string; // ref value that throws when checked out
  failInstall?: boolean;
}

function fakeGit(opts: FakeOpts = {}): { git: GitRunner; calls: string[] } {
  const calls: string[] = [];
  const git: GitRunner = {
    async currentRef() {
      return "feat/kit";
    },
    async dirtyTrackedFiles() {
      return opts.dirty ?? [];
    },
    async fetchTags() {
      calls.push("fetch");
    },
    async tagExists() {
      return opts.tagExists ?? true;
    },
    async checkout(ref) {
      calls.push(`checkout:${ref}`);
      if (opts.failCheckout && ref === opts.failCheckout) throw new Error("checkout boom");
    },
    async install() {
      calls.push("install");
      if (opts.failInstall) throw new Error("install boom");
    },
  };
  return { git, calls };
}

describe("sourceSwitch", () => {
  test("refuses a dirty tracked tree and names the files", async () => {
    const { git } = fakeGit({ dirty: ["src/a.ts", "src/b.ts"] });
    await expect(sourceSwitch("v0.1.9", { git })).rejects.toThrow(/uncommitted changes in src\/a\.ts, src\/b\.ts/);
  });

  test("happy path checks out the tag and reinstalls, returns a restart action", async () => {
    const { git, calls } = fakeGit();
    const action = await sourceSwitch("v0.1.9", { git, relaunch: () => {} });
    expect(action.kind).toBe("restart");
    expect(calls).toEqual(["fetch", "checkout:v0.1.9", "install"]);
  });

  test("refuses when the tag does not exist", async () => {
    const { git } = fakeGit({ tagExists: false });
    await expect(sourceSwitch("v9.9.9", { git })).rejects.toThrow(/no release is tagged/);
  });

  test("restores the prior ref + reinstalls when checkout fails, then rethrows the original error", async () => {
    const { git, calls } = fakeGit({ failCheckout: "v0.1.9" });
    await expect(sourceSwitch("v0.1.9", { git, relaunch: () => {} })).rejects.toThrow("checkout boom");
    // it tried the tag, then restored to feat/kit and reinstalled
    expect(calls).toEqual(["fetch", "checkout:v0.1.9", "checkout:feat/kit", "install"]);
  });

  test("restores when install fails after a good checkout", async () => {
    const { git, calls } = fakeGit({ failInstall: true });
    await expect(sourceSwitch("v0.1.9", { git, relaunch: () => {} })).rejects.toThrow("install boom");
    // checkout tag, install (boom), then restore checkout + install
    expect(calls).toEqual(["fetch", "checkout:v0.1.9", "install", "checkout:feat/kit", "install"]);
  });
});
