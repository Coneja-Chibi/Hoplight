/**
 * The render contract: what Hoplight asks a platform's own macro engine, and what it must answer.
 *
 * WHY THIS EXISTS. Every claim this repo makes about a converted preset is currently structural: the
 * translator reports what it rewrote, transfer-check reports what has no counterpart on the target. None
 * of that is the same as the target engine actually resolving the file. A conversion can be clean by
 * every check we own and still emit `{{choice::x}}` into somebody's prompt, which is exactly the defect
 * found in a hand-built SillyTavern preset that all of our own checks passed.
 *
 * So the question a renderer answers is narrow and empirical: assemble this preset the way you really
 * would, and tell us what did not resolve.
 *
 * A SUBPROCESS, NOT AN IMPORT, and that is a deliberate reversal. Importing a platform's engine was
 * tried and measured: SillyTavern's needs twenty-one shimmed modules standing in for its browser
 * application, its own npm dependencies present, browser globals installed before evaluation, and a
 * resolver scoped precisely enough to leave node_modules alone. A first attempt that over-matched
 * silently replaced its parser library with empty modules. Running someone else's application internals
 * inside our process buys nothing and costs isolation, so the engine runs as its own process and answers
 * over stdout.
 *
 * This module is PURE. It owns the shapes and the parsing of a renderer's reply; runner.ts owns the
 * spawning. The split is the same one sidecar-status.ts and sidecar-manager.ts already use, and for the
 * same reason: the part worth testing exhaustively should not need a process to test it.
 */

/** Which engine answered, and which build of it. Mandatory on every success. */
export interface EngineStamp {
  /** platform id, matching the adapter family: "sillytavern", "rolecall", "marinara", "lumiverse" */
  readonly name: string;
  /** the engine's own version string, however it reports one */
  readonly version: string;
  /**
   * Where the engine came from: a bundled copy, or a path the user declared. Recorded because a stale
   * copy is the failure this whole feature is most likely to hide. A vendored SillyTavern engine in this
   * very repository had already drifted from the install sitting beside it, so a renderer that cannot
   * say which build it modelled is agreeing with a SillyTavern that may no longer exist.
   */
  readonly source: string;
}

/** One macro the engine could not resolve, as it appears in the assembled prompt. */
export interface UnresolvedMacro {
  /** the token as written, e.g. "{{choice::language_selector}}" */
  readonly token: string;
  /** how many times it survived into the assembled prompt */
  readonly count: number;
  /** a locator the engine can offer, when it can; free-form and never parsed */
  readonly where?: string;
}

export interface RenderedPreset {
  readonly ok: true;
  /** the assembled prompt, exactly as the engine would send it */
  readonly prompt: string;
  /** macros still present in `prompt` after the engine finished with it */
  readonly unresolved: readonly UnresolvedMacro[];
  /** anything the engine wants to say that is not a failure */
  readonly warnings: readonly string[];
  readonly engine: EngineStamp;
}

/**
 * Why a render did not happen. Every one of these is a VALUE. A caller asking "is this conversion
 * clean" must be able to distinguish "the engine says yes" from "nobody asked the engine", and a throw
 * collapses that distinction into a stack trace at exactly the wrong moment.
 */
export type RenderFailure =
  /** no renderer is declared for this platform on this machine */
  | "no-renderer"
  /** the command could not be started at all */
  | "spawn-failed"
  /** the renderer ran too long and was killed */
  | "timeout"
  /** the renderer exited non-zero */
  | "engine-error"
  /** stdout was not a reply this contract recognises */
  | "bad-output"
  /** stdout exceeded the cap before a reply arrived */
  | "too-large";

export interface RenderRefusal {
  readonly ok: false;
  readonly reason: RenderFailure;
  /** one sentence, already phrased for a reader */
  readonly detail: string;
}

export type RenderOutcome = RenderedPreset | RenderRefusal;

export const refuse = (reason: RenderFailure, detail: string): RenderRefusal => ({
  ok: false,
  reason,
  detail,
});

/**
 * Who the two speakers are, for the macros that name them.
 *
 * SEPARATE FROM `state`, because the engines are. A variable store is one thing both adapters expose
 * and `state` fills; identity is read from somewhere else entirely - SillyTavern's context object,
 * Marinara's resolve context - so a caller cannot reach it by naming a variable "char". Without this
 * field the most-typed macro of all, `{{char}}`, always answered "Character" no matter who the
 * caller meant, which is fine for a conversion check and useless for anyone asking what their text
 * actually says.
 *
 * Absent means the adapter's own default, so every existing caller keeps the behaviour it had.
 */
export interface RenderIdentity {
  /** who `{{user}}` is */
  readonly user?: string;
  /** who `{{char}}` is */
  readonly char?: string;
}

/** What a renderer is asked. Serialized to its stdin as one JSON object. */
export interface RenderRequest {
  /** absolute path to the preset file, in the platform's own wire format */
  readonly preset: string;
  /** variables to pre-set before assembly; the engine's own naming, passed through untouched */
  readonly state?: Readonly<Record<string, string>>;
  /** the two speakers, when the caller has someone in mind; the adapter's default otherwise */
  readonly identity?: RenderIdentity;
}

/** The reply shape, before validation. Kept separate so the parser can say precisely what was wrong. */
interface RawReply {
  prompt?: unknown;
  unresolved?: unknown;
  warnings?: unknown;
  engine?: unknown;
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

function parseEngine(raw: unknown): EngineStamp | null {
  if (raw === null || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = str(r.name);
  const version = str(r.version);
  const source = str(r.source);
  // All three are required. A stamp missing its version is the stale-engine hazard wearing a disguise,
  // so it is refused rather than defaulted to "unknown".
  if (!name || !version || !source) return null;
  return { name, version, source };
}

function parseUnresolved(raw: unknown): UnresolvedMacro[] | null {
  if (!Array.isArray(raw)) return null;
  const out: UnresolvedMacro[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== "object") return null;
    const r = item as Record<string, unknown>;
    const token = str(r.token);
    if (!token) return null;
    const count = typeof r.count === "number" && Number.isFinite(r.count) ? Math.trunc(r.count) : 1;
    const where = str(r.where);
    out.push(where ? { token, count, where } : { token, count });
  }
  return out;
}

/**
 * Turn a renderer's stdout into an outcome. Never throws: malformed output is a refusal with a reason,
 * because a renderer that answers badly and a renderer that answers "all clear" must never be confused.
 *
 * Deliberately strict about `unresolved`. A reply that omits it is REFUSED rather than read as an empty
 * list, since "the field was missing" and "nothing was unresolved" are the two answers this whole
 * feature exists to tell apart.
 */
export function parseRenderReply(stdout: string): RenderOutcome {
  const text = stdout.trim();
  if (!text) return refuse("bad-output", "the renderer produced no output");

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    // A renderer that logs to stdout will land here; the last line is the usual convention, so try it
    // before giving up, and say what was seen rather than just "invalid".
    const last = text.slice(text.lastIndexOf("\n") + 1).trim();
    try {
      raw = JSON.parse(last);
    } catch {
      return refuse("bad-output", `the renderer did not answer with JSON: ${text.slice(0, 120)}`);
    }
  }

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return refuse("bad-output", "the renderer's reply was not an object");
  }
  const reply = raw as RawReply;

  if (typeof reply.prompt !== "string") {
    return refuse("bad-output", "the renderer's reply carried no assembled prompt");
  }
  const engine = parseEngine(reply.engine);
  if (!engine) {
    return refuse("bad-output", "the renderer did not stamp which engine and version answered");
  }
  const unresolved = parseUnresolved(reply.unresolved);
  if (!unresolved) {
    return refuse("bad-output", "the renderer did not report its unresolved macros");
  }
  const warnings = Array.isArray(reply.warnings)
    ? reply.warnings.filter((w): w is string => typeof w === "string")
    : [];

  return { ok: true, prompt: reply.prompt, unresolved, warnings, engine };
}

/** Total unresolved occurrences, which is the number a receipt actually reports. */
export const unresolvedCount = (r: RenderedPreset): number =>
  r.unresolved.reduce((n, u) => n + u.count, 0);
