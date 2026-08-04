/**
 * Reading the OS clipboard, and opening a file's folder.
 *
 * WHY THE OS AND NOT THE TERMINAL. `clipboard.ts` copies OUT through OSC52, which is a request to
 * the terminal and needs no help from us. Reading back is not symmetrical: OSC52 paste is disabled by
 * default in almost every terminal because a program that can silently read your clipboard is a
 * program that can read the password you copied a minute ago. So a paste that works is one that asks
 * the operating system, on a keystroke the person pressed.
 *
 * BOUNDED AND FAIL-CLOSED, because this is untrusted input crossing into the composer: a cap on
 * bytes, a timeout so a wedged helper cannot hang a keypress, and every failure returning null rather
 * than throwing. Nothing here decides what to DO with the text; the composer does.
 */
const READ_TIMEOUT_MS = 2_000;

/** A clipboard bigger than this is not something somebody meant to paste into a chat composer. */
export const MAX_PASTE_BYTES = 256 * 1024;

/** Run a helper and return its stdout, or null on any failure at all. */
async function run(command: string[], timeoutMs = READ_TIMEOUT_MS): Promise<string | null> {
  try {
    const child = Bun.spawn(command, { stdout: "pipe", stderr: "ignore" });
    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* already gone */ }
    }, timeoutMs);
    const text = await new Response(child.stdout).text();
    clearTimeout(timer);
    await child.exited;
    if (child.exitCode !== 0) return null;
    return text;
  } catch {
    return null;
  }
}

/**
 * The clipboard's text, or null when there is none or it cannot be read.
 *
 * Windows goes through PowerShell's `Get-Clipboard`, which is the only route that does not need a
 * native module. `-Raw` keeps the text whole rather than splitting it into lines, which matters for a
 * pasted path: without it a folder name containing a newline would arrive as two pastes.
 */
export async function readClipboardText(): Promise<string | null> {
  const text = process.platform === "win32"
    ? await run(["powershell", "-NoProfile", "-NonInteractive", "-Command", "Get-Clipboard -Raw"])
    : process.platform === "darwin"
      ? await run(["pbpaste"])
      : (await run(["wl-paste", "--no-newline"])) ?? (await run(["xclip", "-selection", "clipboard", "-o"]));
  if (text === null) return null;
  // PowerShell appends a trailing newline of its own; stripping exactly one keeps a deliberate blank
  // line the person copied while removing the one the helper added.
  const cleaned = text.replace(/\r\n$|\n$/, "");
  if (cleaned === "") return null;
  if (new TextEncoder().encode(cleaned).byteLength > MAX_PASTE_BYTES) return null;
  return cleaned;
}

/** An image bigger than this is not something to splice into a chat turn. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * The clipboard's IMAGE, written to a temp file and read back as bytes.
 *
 * VIA A FILE, and not because it is elegant. Every OS helper here already knows how to encode a
 * clipboard bitmap as PNG; none of them will hand those bytes down a pipe without mangling them,
 * because stdout is a text stream and a PNG is full of bytes a shell will happily reinterpret. A
 * temp file is the one channel that carries them intact.
 *
 * PNG rather than the clipboard's native bitmap: it is what `signature-color.ts` already decodes,
 * what every card format stores, and it survives the round trip losslessly.
 *
 * The file is deleted whether or not the read worked. A screenshot left in the temp directory is
 * somebody's private screen, sitting somewhere they did not put it.
 */
export async function readClipboardImage(): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { readFile, unlink } = await import("node:fs/promises");
  const { randomUUID } = await import("node:crypto");

  const path = join(tmpdir(), `kit-paste-${randomUUID()}.png`);
  try {
    if (process.platform === "win32") {
      // -STA is load-bearing: the Windows clipboard API is single-threaded-apartment only, and
      // PowerShell started any other way returns null for an image that is plainly there.
      const script =
        "Add-Type -AssemblyName System.Windows.Forms;"
        + "$i=[System.Windows.Forms.Clipboard]::GetImage();"
        + `if($i){$i.Save('${path.replace(/'/g, "''")}',[System.Drawing.Imaging.ImageFormat]::Png)}`;
      await run(["powershell", "-NoProfile", "-NonInteractive", "-STA", "-Command", script], 6_000);
    } else if (process.platform === "darwin") {
      await run(["osascript", "-e",
        `set f to (open for access POSIX file "${path}" with write permission)`
        + `\ntry\n  write (the clipboard as «class PNGf») to f\nend try\nclose access f`], 6_000);
    } else {
      const wl = await run(["wl-paste", "--type", "image/png"], 6_000);
      if (wl === null) await run(["sh", "-c", `xclip -selection clipboard -t image/png -o > '${path}'`], 6_000);
      else await Bun.write(path, wl);
    }

    const bytes = await readFile(path).catch(() => null);
    if (!bytes || bytes.byteLength === 0) return null;
    if (bytes.byteLength > MAX_IMAGE_BYTES) return null;
    // Verify it really is a PNG rather than trusting the extension we chose: a helper that failed
    // quietly can leave a zero-length or half-written file, and handing that on as image bytes
    // would push the failure into whatever decodes it next.
    const png = [0x89, 0x50, 0x4e, 0x47];
    if (!png.every((b, i) => bytes[i] === b)) return null;
    return { bytes: new Uint8Array(bytes), mime: "image/png" };
  } catch {
    return null;
  } finally {
    await unlink(path).catch(() => {});
  }
}

/**
 * Show a file in its folder, the way double-clicking a path in an editor does.
 *
 * SELECTS the file rather than opening it. Opening would hand an arbitrary file to whatever
 * application claims its extension, which is a much larger action than "show me where this is" and
 * not what a person means by clicking a path in a transcript. `explorer /select,` and `open -R` both
 * reveal; the Linux fallback opens the containing DIRECTORY for the same reason.
 *
 * Returns whether the reveal was requested, never whether a window appeared - that is the OS's
 * business and nothing here can honestly claim it.
 */
export async function revealInFolder(path: string): Promise<boolean> {
  const { dirname, isAbsolute } = await import("node:path");

  /**
   * REFUSE ANYTHING THAT IS NOT AN ABSOLUTE PATH.
   *
   * This is the argv-flag-smuggling guard, and it is one check rather than several because an
   * absolute path cannot begin with `-`. Without it, a path like `--version` or `-W` reaches `open`
   * and `xdg-open` as an OPTION rather than a subject: `Bun.spawn` uses no shell, so quoting is not
   * the risk, but argv position still is.
   *
   * Validating beats appending `--`. Not every one of these helpers parses an end-of-options marker
   * the same way (`xdg-open` is a shell script, and `open`'s handling is BSD-flavoured), so a
   * terminator can be a no-op on one platform and an unexpected argument on another. A path that is
   * not absolute is not something to reveal in any case, so refusing costs nothing real.
   *
   * Fail closed, and quietly: `false` means nothing was asked for, and the caller says so.
   */
  if (!path || path.startsWith("-") || !isAbsolute(path)) return false;

  try {
    if (process.platform === "win32") {
      // One argv element by construction, so a path with spaces or quotes cannot split into extra
      // arguments - and the check above already refuses a leading dash.
      Bun.spawn(["explorer", `/select,${path}`], { stdout: "ignore", stderr: "ignore" });
      return true;
    }
    if (process.platform === "darwin") {
      Bun.spawn(["open", "-R", path], { stdout: "ignore", stderr: "ignore" });
      return true;
    }
    Bun.spawn(["xdg-open", dirname(path)], { stdout: "ignore", stderr: "ignore" });
    return true;
  } catch {
    return false;
  }
}
