/**
 * Pure CLI convert IO policy: flag parse, path identity, container agreement, atomic publish.
 * No adapter/format logic. Fail closed on in-place writes and container mismatches.
 */
import { basename, dirname, extname, isAbsolute, join, normalize, resolve, sep } from "node:path";
import { open, rename, realpath, stat, unlink } from "node:fs/promises";
import { randomBytes } from "node:crypto";

export type ConvertFlags =
  | { ok: true; yes: boolean; to?: string; rest: string[] }
  | { ok: false; error: string };

/**
 * Parse convert tail flags after `<in> <out>`. Accepts `--yes` and `--to <format>`.
 * Rejects unknown flags, missing --to values, and duplicates.
 */
export function parseConvertFlags(args: string[]): ConvertFlags {
  let yes = false;
  let to: string | undefined;
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--yes" || a === "-y") {
      if (yes) return { ok: false, error: "duplicate --yes" };
      yes = true;
      continue;
    }
    if (a === "--to") {
      if (to !== undefined) return { ok: false, error: "duplicate --to" };
      const v = args[i + 1];
      if (!v || v.startsWith("-")) return { ok: false, error: "--to requires a format id" };
      to = v;
      i++;
      continue;
    }
    if (a === "--json") {
      // global flag already consumed by main for mode; allow as rest no-op positionally
      rest.push(a);
      continue;
    }
    if (a.startsWith("-")) return { ok: false, error: `unknown flag: ${a}` };
    rest.push(a);
  }
  return { ok: true, yes, to, rest };
}

/** Normalize extension: strip leading dots, lowercase. Empty if none. */
export function normalizeExtension(pathOrExt: string): string {
  const s = pathOrExt.trim();
  if (!s) return "";
  // Bare extension or ".json" / "json" without a path segment
  if (!s.includes("/") && !s.includes("\\")) {
    // "out.charx" still has a basename; use extname when there is a name before the last dot
    const base = s.includes(".") && !s.startsWith(".") ? extname(s) : s;
    return base.replace(/^\.+/, "").toLowerCase();
  }
  return extname(s).replace(/^\.+/, "").toLowerCase();
}

/** Windows-aware path normalize for identity compare (lowercase drive+path on win32). */
export function normalizePathKey(p: string): string {
  const abs = resolve(p);
  const n = normalize(abs);
  return process.platform === "win32" ? n.toLowerCase() : n;
}

/**
 * True when input and output refer to the same filesystem target.
 * Uses realpath when both exist; otherwise compares normalized absolute paths
 * (parent + basename) so relative/case aliases still match on Windows.
 */
export async function pathsAreSame(inputPath: string, outputPath: string): Promise<boolean> {
  const aKey = normalizePathKey(inputPath);
  const bKey = normalizePathKey(outputPath);
  if (aKey === bKey) return true;

  try {
    const [ra, rb] = await Promise.all([realpath(inputPath), realpath(outputPath)]);
    const raKey = normalizePathKey(ra);
    const rbKey = normalizePathKey(rb);
    if (raKey === rbKey) return true;
  } catch {
    /* one or both missing: fall through to parent+name compare */
  }

  // Prospective output: compare resolved parent + filename
  const aParent = normalizePathKey(dirname(resolve(inputPath)));
  const bParent = normalizePathKey(dirname(resolve(outputPath)));
  const aName = basename(inputPath);
  const bName = basename(outputPath);
  const nameEq =
    process.platform === "win32" ? aName.toLowerCase() === bName.toLowerCase() : aName === bName;
  return aParent === bParent && nameEq;
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export type OutputGuard =
  | { ok: true }
  | { ok: false; error: string; code: "in-place" | "exists" };

/**
 * Guard convert output path: never in-place; existing output requires --yes.
 */
export async function guardConvertOutput(
  inPath: string,
  outPath: string,
  yes: boolean,
): Promise<OutputGuard> {
  if (await pathsAreSame(inPath, outPath)) {
    return {
      ok: false,
      code: "in-place",
      error: "refusing in-place conversion (input and output are the same path)",
    };
  }
  if (await pathExists(outPath) && !yes) {
    return {
      ok: false,
      code: "exists",
      error: `output already exists: ${outPath} (pass --yes to replace)`,
    };
  }
  return { ok: true };
}

const ZIP_MAGIC = [0x50, 0x4b] as const; // PK

/** True when bytes look like a ZIP/charx container. */
export function isZipBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === ZIP_MAGIC[0] && bytes[1] === ZIP_MAGIC[1];
}

/** True when text parses as JSON (object or array). */
export function isJsonText(text: string): boolean {
  try {
    const v = JSON.parse(text);
    return v !== null && (typeof v === "object" || Array.isArray(v));
  } catch {
    return false;
  }
}

export type ContainerCheck =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Assert adapter output matches requested extension and actual payload shape.
 * charx/zip: bytes with ZIP magic. json: text that parses as JSON (or bytes that are UTF-8 JSON).
 */
export function assertContainerAgreement(
  requestedExt: string,
  suggestedExt: string,
  out: { bytes?: Uint8Array; text?: string },
): ContainerCheck {
  const req = normalizeExtension(requestedExt);
  const sug = normalizeExtension(suggestedExt);
  if (!req) return { ok: false, error: "output path has no extension" };
  if (sug && sug !== req) {
    return {
      ok: false,
      error: `adapter suggested .${sug} but output path requests .${req}`,
    };
  }

  if (req === "charx" || req === "byaf" || req === "zip") {
    if (!out.bytes || !isZipBytes(out.bytes)) {
      return { ok: false, error: `expected ZIP bytes for .${req}` };
    }
    return { ok: true };
  }

  if (req === "json" || req === "lorebook" || req === "txt") {
    if (out.text !== undefined) {
      if (!isJsonText(out.text) && req === "json") {
        return { ok: false, error: "expected JSON text for .json" };
      }
      return { ok: true };
    }
    if (out.bytes) {
      try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(out.bytes);
        if (req === "json" && !isJsonText(text)) {
          return { ok: false, error: "expected JSON bytes for .json" };
        }
        return { ok: true };
      } catch {
        return { ok: false, error: `expected text payload for .${req}` };
      }
    }
    return { ok: false, error: `empty output for .${req}` };
  }

  // Other extensions: require non-empty bytes or text
  if (!out.bytes && out.text === undefined) {
    return { ok: false, error: "empty adapter output" };
  }
  return { ok: true };
}

/**
 * Atomic publish: write temp sibling then rename over destination.
 * On failure, prior destination is unchanged and temp is removed.
 */
export async function publishAtomic(
  finalPath: string,
  payload: Uint8Array | string,
): Promise<void> {
  const dir = dirname(resolve(finalPath));
  const tag = randomBytes(8).toString("hex");
  const tmp = join(dir, `.vaud-tmp-${tag}${extname(finalPath) || ".bin"}`);
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(tmp, "wx");
    if (typeof payload === "string") await handle.writeFile(payload, "utf8");
    else await handle.writeFile(payload);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(tmp, finalPath);
  } catch (e) {
    try {
      await unlink(tmp);
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

/** True when path is absolute (for callers that care). */
export const isAbs = (p: string): boolean => isAbsolute(p);

/** Path separator for tests/docs. */
export const pathSep = sep;
