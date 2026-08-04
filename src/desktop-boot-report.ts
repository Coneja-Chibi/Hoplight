/**
 * Boot-failure reporting for the packaged desktop app - the surface that makes a failed launch SAY
 * something.
 *
 * WHY THIS EXISTS. Hoplight.exe is compiled with `--windows-hide-console`, which does NOT produce a
 * GUI-subsystem binary: the shipped exe is subsystem 3 (console) and Bun hides the console window at
 * startup instead. Verified by reading the PE header of a real build. So Windows allocates a console on
 * every launch and something hides it, which means a crash during boot prints a perfectly good stack
 * trace into a window that vanishes. The field report was "it pops up the Terminal for a second, then
 * closes without a message" - the message existed, it just had nowhere to land.
 *
 * Two outputs, because they answer different questions:
 *   - A LOG FILE, which is the durable artifact somebody can paste into a bug report.
 *   - A NATIVE DIALOG, which is the only thing a user who double-clicked an icon will ever see.
 *
 * The dialog is reserved for FATAL failures. It is a blocking modal on the thread that runs Bun.serve
 * (measured: the server answers nothing while a message box is up), which is harmless when the studio
 * never came up and we are about to exit, and actively wrong when it did - see reportWindowFailure.
 *
 * The log path deliberately avoids the studio folder. Resolving the studio folder is itself a boot step
 * that can throw (resolve-dir.ts renames directories), and a crash reporter that needs the thing that
 * crashed reports nothing.
 *
 * SCOPE, stated honestly: this covers failures that reach JavaScript. A process aborted by the OS or the
 * CPU before our code runs - a corrupt download, an unsupported instruction set - produces no log and no
 * dialog, because nothing of ours ever executes. For those, launching from a terminal is still the only
 * way to see what happened, which is why every message here says so.
 */
import { mkdirSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { openInBrowser } from "./ui/server-security";
import { APP_VERSION } from "./version";

/** MB_OK | MB_ICONERROR | MB_SETFOREGROUND | MB_TOPMOST - a boot failure must not open behind a window. */
const MB_ERROR = 0x10 | 0x10000 | 0x40000;
/** MB_OK | MB_ICONWARNING | MB_SETFOREGROUND | MB_TOPMOST */
const MB_WARN = 0x30 | 0x10000 | 0x40000;

/** UTF-16LE, NUL-terminated: what the W (wide) Win32 entry points expect. */
function wide(text: string): Uint8Array {
  const buf = new Uint8Array((text.length + 1) * 2);
  const view = new DataView(buf.buffer);
  for (let i = 0; i < text.length; i++) view.setUint16(i * 2, text.charCodeAt(i), true);
  return buf; // final code unit stays 0
}

/**
 * Shows a modal alert to the user. INJECTED rather than called directly, for one blunt reason: the real
 * implementation BLOCKS until the box is dismissed, so a test that reached it would hang the suite
 * forever with no window to click. Tests pass their own.
 */
export type Notifier = (title: string, body: string, level: "error" | "warning") => void;

/**
 * A blocking native message box. Windows only, and best-effort by construction: if user32 cannot be
 * opened we have already failed to start, and throwing here would replace a real diagnosis with a
 * meaningless one.
 */
export const nativeNotifier: Notifier = (title, body, level) => {
  if (process.platform !== "win32") return;
  try {
    const { dlopen, FFIType } = require("bun:ffi") as typeof import("bun:ffi");
    const user32 = dlopen("user32.dll", {
      MessageBoxW: {
        args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.u32],
        returns: FFIType.i32,
      },
    });
    user32.symbols.MessageBoxW(null, wide(body), wide(title), level === "error" ? MB_ERROR : MB_WARN);
  } catch {
    /* no dialog available; the log file and stderr still carry the report */
  }
};

/** Where a crash report lands. Never under the studio folder - see the file header. */
export function bootLogPath(): string {
  const base =
    process.platform === "win32"
      ? process.env.LOCALAPPDATA || tmpdir()
      : process.env.XDG_STATE_HOME || tmpdir();
  return join(base, "Hoplight", "boot-error.log");
}

const describe = (err: unknown): string =>
  err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? "(no stack)"}` : String(err);

/** One log entry. Separated from the write so its contents can be asserted without touching a disk. */
export function formatReport(kind: string, err: unknown, at: Date): string {
  return (
    `\n===== ${kind} =====\n` +
    `when      ${at.toISOString()}\n` +
    `version   ${APP_VERSION}\n` +
    `runtime   Bun ${Bun.version} on ${process.platform} ${process.arch}\n` +
    `exe       ${process.execPath}\n` +
    `${describe(err)}\n`
  );
}

/**
 * Append one report to the log and return its path, or null when even that failed (a read-only profile,
 * a full disk). Returning null rather than throwing keeps the dialog honest: it can only promise a log
 * file that actually got written.
 */
export function writeBootLog(kind: string, err: unknown, path = bootLogPath()): string | null {
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, formatReport(kind, err, new Date()), "utf8");
    return path;
  } catch {
    return null;
  }
}

/** The line that tells someone how to get the full text when the dialog is all they have. */
const terminalHint =
  "To see the full error text, open PowerShell in the folder holding Hoplight.exe and run:  .\\Hoplight.exe";

/**
 * The studio never came up. Report through every channel available, then let the caller exit non-zero.
 * Never throws: a reporter that fails is not allowed to replace the failure it was reporting.
 */
export function reportBootFailure(err: unknown, notify: Notifier = nativeNotifier): void {
  // stderr first and unconditionally: this is the channel that works when the app is launched FROM a
  // terminal, which is the one situation where the console does not disappear.
  console.error("Hoplight could not start:", describe(err));
  const path = writeBootLog("boot failure", err);
  const detail = err instanceof Error ? err.message : String(err);
  notify(
    "Hoplight could not start",
    `Hoplight ${APP_VERSION} stopped while starting up.\n\n` +
      `${detail}\n\n` +
      (path ? `A full report was saved to:\n${path}\n\n` : "The report could not be written to disk.\n\n") +
      terminalHint,
    "error",
  );
}

/**
 * The server is up but the native window did not open - overwhelmingly a missing WebView2 runtime, whose
 * loader failure arrives here as a worker error (proven: a failed dlopen in a worker fires the main
 * thread's error listener and the process survives).
 *
 * NOT fatal, and it must not exit: the studio is already serving, so throwing the process away over a
 * missing system runtime would discard a working studio.
 *
 * DELIBERATELY NO DIALOG HERE, and this is the interesting part. nativeNotifier is a blocking modal, and
 * the main thread is the one running Bun.serve - measured: with a message box up, a request to the
 * server got no answer until the box was dismissed. So a dialog reading "open this address in your
 * browser" would name an address that cannot respond while the dialog naming it is on screen. Opening
 * the browser directly is both non-blocking and the thing the dialog was going to ask for anyway; the
 * page that loads is the user's own studio, which explains itself better than a modal would.
 */
export function reportWindowFailure(
  url: string,
  err: unknown,
  openUrl: (url: string) => void = openInBrowser,
): void {
  console.error("Hoplight: the app window could not open:", describe(err));
  console.error(`Hoplight is still running, without its window. Opening it in your browser: ${url}`);
  console.error(
    "To get the app window back, install Microsoft's WebView2 runtime: " +
      "https://developer.microsoft.com/microsoft-edge/webview2/",
  );
  writeBootLog("window failure", err);
  openUrl(url);
}
