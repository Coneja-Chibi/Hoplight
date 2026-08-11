/**
 * The staging sweep, pinned because the leak it fixes was demonstrated rather than theorised.
 *
 * tools/renderers/sillytavern/stage.mjs copies SillyTavern's macro tree into a scratch directory
 * INSIDE the user's own checkout. Cleanup was registered only on `process.on("exit")`, which Bun's
 * child.kill() does not reach on Windows - so every render timeout deposited a full copy of somebody
 * else's engine under their public/scripts/, permanently, with nothing in this repo to reclaim it.
 *
 * The signal handlers cannot be tested here (they need a real kill on a real platform, and on
 * Windows the hard terminate cannot be intercepted at all). The sweep can, and the sweep is what
 * actually bounds the residue.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// The adapter is plain .mjs with no types of its own, which is deliberate: it runs under Node
// against somebody else's engine, not under our build. Narrowed here rather than given a .d.ts.
const stage = (await import(
  "../../../../tools/renderers/sillytavern/stage.mjs" as string
)) as { sweepStale: (scriptsDir: string) => void };
const { sweepStale } = stage;

/** A pid high enough that no process holds it, so `process.kill(pid, 0)` reports it gone. */
const DEAD_PID = 4_000_000;

const withDir = (run: (dir: string) => void): void => {
  const dir = mkdtempSync(join(tmpdir(), "hoplight-sweep-"));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe("sweepStale", () => {
  test("removes a staging directory whose process is gone", () => {
    withDir((dir) => {
      const stale = join(dir, `.hoplight-render-${DEAD_PID}`);
      mkdirSync(stale);
      writeFileSync(join(stale, "macro-system.js"), "// a copy of somebody else's engine");
      sweepStale(dir);
      expect(existsSync(stale)).toBe(false);
    });
  });

  /**
   * THE ONE THAT MAKES IT SAFE. preset_verify and the Macro Lab can stage at the same moment, so a
   * sweep keyed on name or mtime would delete a directory another process is loading out of.
   */
  test("leaves a live process's directory alone, including its own", () => {
    withDir((dir) => {
      const mine = join(dir, `.hoplight-render-${process.pid}`);
      mkdirSync(mine);
      sweepStale(dir);
      expect(existsSync(mine)).toBe(true);
    });
  });

  test("touches nothing that is not a staging directory", () => {
    withDir((dir) => {
      const real = join(dir, "macros");
      const dotted = join(dir, ".hoplight-notes");
      mkdirSync(real);
      mkdirSync(dotted);
      sweepStale(dir);
      expect(existsSync(real)).toBe(true);
      expect(existsSync(dotted)).toBe(true);
    });
  });

  test("says nothing and does nothing when the folder cannot be read", () => {
    expect(() => sweepStale(join(tmpdir(), "hoplight-no-such-folder-at-all"))).not.toThrow();
  });
});
