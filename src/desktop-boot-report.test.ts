/**
 * Contract for the boot-failure reporter: the packaged app must SAY why it could not start.
 *
 * The defect these cover: Hoplight.exe compiles with --windows-hide-console, which leaves a
 * console-subsystem binary whose console is hidden at startup, so a boot crash printed its stack into a
 * window that vanished ("pops up the Terminal for a second, then closes without a message").
 *
 * The notifier is INJECTED in every test here. The real one blocks until a human dismisses it, so a test
 * that reached it would hang the suite with no window to click.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  bootLogPath,
  formatReport,
  reportBootFailure,
  reportWindowFailure,
  writeBootLog,
  type Notifier,
} from "./desktop-boot-report";
import { APP_VERSION } from "./version";

/** Captures what a user would have been shown, instead of blocking on a real dialog. */
function spyNotifier(): { calls: { title: string; body: string; level: string }[]; notify: Notifier } {
  const calls: { title: string; body: string; level: string }[] = [];
  return { calls, notify: (title, body, level) => calls.push({ title, body, level }) };
}

const scratch = (): string => join(mkdtempSync(join(tmpdir(), "hoplight-bootlog-")), "boot-error.log");

/**
 * Point bootLogPath() at a throwaway directory for the tests that exercise the real write path. Without
 * this the suite would append to the developer's own %LOCALAPPDATA%\Hoplight\boot-error.log on every run,
 * seeding a diagnostic file with failures that never happened.
 */
function withScratchHome<T>(run: () => T): T {
  const home = mkdtempSync(join(tmpdir(), "hoplight-boothome-"));
  const keys = ["LOCALAPPDATA", "XDG_STATE_HOME"] as const;
  const saved = keys.map((k) => [k, process.env[k]] as const);
  for (const k of keys) process.env[k] = home;
  try {
    return run();
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe("boot log", () => {
  test("names the version, the runtime and the exe, so a pasted report identifies the build", () => {
    const entry = formatReport("boot failure", new Error("assets not baked"), new Date(0));
    expect(entry).toContain("boot failure");
    expect(entry).toContain(APP_VERSION);
    expect(entry).toContain("1970-01-01T00:00:00.000Z");
    expect(entry).toContain(process.execPath);
    expect(entry).toContain("assets not baked");
  });

  test("carries the stack, because the message alone rarely locates a boot crash", () => {
    const entry = formatReport("boot failure", new Error("nope"), new Date(0));
    expect(entry).toContain("Error: nope");
    expect(entry).toMatch(/at .+/);
  });

  test("a non-Error throw is still reported rather than dropped", () => {
    expect(formatReport("boot failure", "just a string", new Date(0))).toContain("just a string");
  });

  test("APPENDS, so a second failed launch does not erase the evidence from the first", () => {
    const path = scratch();
    expect(writeBootLog("boot failure", new Error("first"), path)).toBe(path);
    expect(writeBootLog("boot failure", new Error("second"), path)).toBe(path);
    const text = readFileSync(path, "utf8");
    expect(text).toContain("first");
    expect(text).toContain("second");
  });

  test("an unwritable path returns null instead of throwing - the reporter must never replace the failure it reports", () => {
    // A path whose parent is an existing FILE: mkdir cannot create it.
    const file = scratch();
    writeBootLog("boot failure", new Error("seed"), file);
    expect(writeBootLog("boot failure", new Error("x"), join(file, "nested", "boot-error.log"))).toBeNull();
  });

  test("the log never lives under the studio folder", () => {
    // Resolving the studio folder is itself a boot step that can throw (resolve-dir renames
    // directories), so a report written there would be lost in exactly the case it is needed.
    expect(bootLogPath()).not.toContain("Hoplight Studio");
    expect(bootLogPath()).toContain("Hoplight");
  });
});

describe("fatal boot failure", () => {
  test("tells the user it stopped, and how to see the full text", () => {
    const spy = spyNotifier();
    withScratchHome(() => reportBootFailure(new Error("no free port between 8321 and 8330"), spy.notify));
    expect(spy.calls).toHaveLength(1);
    const { title, body, level } = spy.calls[0]!;
    expect(level).toBe("error");
    expect(title).toContain("could not start");
    expect(body).toContain("no free port");
    // The one instruction that works even when nothing of ours ran: an inherited console persists.
    expect(body).toContain("Hoplight.exe");
    expect(body).toContain("PowerShell");
  });

  test("points at a log file that was actually written, never a promised one", () => {
    const spy = spyNotifier();
    withScratchHome(() => reportBootFailure(new Error("boom"), spy.notify));
    const body = spy.calls[0]!.body;
    const match = /saved to:\n(.+)/.exec(body);
    if (match) expect(existsSync(match[1]!.trim())).toBe(true);
    else expect(body).toContain("could not be written");
  });
});

describe("window failure", () => {
  test("opens the studio in a browser rather than describing how to", () => {
    // The studio is already serving, so the useful act is showing it. A blocking dialog would be worse
    // than useless here: the modal runs on the thread hosting Bun.serve, so the address it named could
    // not answer until the box was dismissed (measured).
    const opened: string[] = [];
    withScratchHome(() =>
      reportWindowFailure("http://127.0.0.1:8321", new Error("ERR_DLOPEN_FAILED"), (u) => opened.push(u)),
    );
    expect(opened).toEqual(["http://127.0.0.1:8321"]);
  });

  test("does not exit or rethrow - a missing window must not discard a running studio", () => {
    expect(() =>
      withScratchHome(() => reportWindowFailure("http://127.0.0.1:8321", "load failed", () => {})),
    ).not.toThrow();
  });

  test("still records the failure, so the WebView2 cause is recoverable afterwards", () => {
    const path = withScratchHome(() => {
      reportWindowFailure("http://127.0.0.1:8321", new Error("ERR_DLOPEN_FAILED"), () => {});
      return bootLogPath();
    });
    expect(readFileSync(path, "utf8")).toContain("ERR_DLOPEN_FAILED");
  });
});
