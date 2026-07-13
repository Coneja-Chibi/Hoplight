/**
 * Studio filesystem path policy: closed kinds + safe entity IDs + resolve containment.
 * Storage floor for every read/write under the studio root.
 */
import { relative, resolve, sep } from "node:path";
import { StudioValidationError } from "./errors";

/** Closed set of on-disk entity folders. Extend with a plan when a new kind ships. */
export const STUDIO_ENTITY_KINDS = [
  "character",
  "lorebook",
  "persona",
  "pack",
  "regex",
  "preset",
] as const;
export type StudioEntityKind = (typeof STUDIO_ENTITY_KINDS)[number];

const KIND_SET = new Set<string>(STUDIO_ENTITY_KINDS);

/** Hard cap on storage id length (code points via Array.from). */
export const STUDIO_ID_MAX_LEN = 120;

const WIN_RESERVED =
  /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

/** Unicode letters/numbers plus single . _ - separators (no path seps, no controls). */
const ID_OK = /^[\p{L}\p{N}]+(?:[._-][\p{L}\p{N}]+)*$/u;

export const isStudioEntityKind = (k: unknown): k is StudioEntityKind =>
  typeof k === "string" && KIND_SET.has(k);

export function assertStudioEntityKind(k: unknown): StudioEntityKind {
  if (!isStudioEntityKind(k)) {
    throw new StudioValidationError("invalid entity kind");
  }
  return k;
}

/**
 * Whether a candidate storage id is safe under the studio root.
 * Does not rewrite: reject rather than silently sanitize API input.
 */
export function isSafeStudioId(id: unknown): id is string {
  if (typeof id !== "string") return false;
  const n = id.normalize("NFKC");
  if (n.length === 0 || n.length > STUDIO_ID_MAX_LEN) return false;
  if (n === "." || n === "..") return false;
  if (n.includes("..")) return false;
  if (/[/\\]/.test(n) || /[\u0000-\u001f\u007f]/.test(n)) return false;
  if (/\s/.test(n)) return false;
  if (n.endsWith(".") || n.endsWith(" ")) return false;
  if (WIN_RESERVED.test(n)) return false;
  return ID_OK.test(n);
}

export function assertSafeStudioId(id: unknown): string {
  if (!isSafeStudioId(id)) {
    throw new StudioValidationError("invalid entity id");
  }
  return id.normalize("NFKC");
}

/**
 * Resolve a path under the studio root. When `id` is omitted, returns the kind directory.
 * Rejects any relative escape (..).
 */
export function resolveStudioPath(root: string, kind: string, id?: string): string {
  const k = assertStudioEntityKind(kind);
  const rootAbs = resolve(root);
  const kindAbs = resolve(rootAbs, k);
  assertContained(rootAbs, kindAbs);
  if (id === undefined) return kindAbs;
  const safeId = assertSafeStudioId(id);
  const fileAbs = resolve(kindAbs, `${safeId}.json`);
  assertContained(rootAbs, fileAbs);
  return fileAbs;
}

function assertContained(rootAbs: string, candidateAbs: string): void {
  const rel = relative(rootAbs, candidateAbs);
  if (rel === "") return; // same path
  if (rel.startsWith("..") || rel.startsWith(`..${sep}`)) {
    throw new StudioValidationError("path escapes studio root");
  }
  // Windows absolute relative() yields absolute when on another drive
  if (resolve(rel) === rel && rel.includes(":")) {
    throw new StudioValidationError("path escapes studio root");
  }
}
