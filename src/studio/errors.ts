/**
 * Typed studio errors with safe user-facing messages (never absolute paths).
 */

export class StudioValidationError extends Error {
  readonly code = "studio_validation" as const;
  constructor(message: string) {
    super(message);
    this.name = "StudioValidationError";
  }
}

export class StudioNotFoundError extends Error {
  readonly code = "studio_not_found" as const;
  constructor(message = "not found") {
    super(message);
    this.name = "StudioNotFoundError";
  }
}

export type StudioDamageReason =
  | "unreadable-json"
  | "schema-mismatch"
  | "kind-mismatch"
  | "id-mismatch"
  /**
   * The filename cannot be a studio id, so the file cannot be addressed at all.
   *
   * Its own reason because it is not damage in the same sense: the JSON may be perfect. A file
   * called `Aegir Main.json` is simply not reachable through an API whose ids forbid spaces. It
   * still has to be REPORTED, which is the whole point of the entry - the inventory used to skip
   * these silently, so a folder of 147 files listed 3 and said nothing about the other 144.
   */
  | "unusable-filename";

export class StudioReadError extends Error {
  readonly code = "studio_read" as const;
  constructor(
    message = "could not read file",
    readonly reason?: StudioDamageReason,
  ) {
    super(message);
    this.name = "StudioReadError";
  }
}

export const isStudioValidationError = (e: unknown): e is StudioValidationError =>
  e instanceof StudioValidationError ||
  (typeof e === "object" && e !== null && (e as { name?: string }).name === "StudioValidationError");

export const isStudioNotFoundError = (e: unknown): e is StudioNotFoundError =>
  e instanceof StudioNotFoundError ||
  (typeof e === "object" && e !== null && (e as { name?: string }).name === "StudioNotFoundError");

export const isStudioReadError = (e: unknown): e is StudioReadError =>
  e instanceof StudioReadError ||
  (typeof e === "object" && e !== null && (e as { name?: string }).name === "StudioReadError");
