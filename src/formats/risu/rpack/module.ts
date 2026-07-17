/**
 * Typed view of a decoded Risu module JSON object. Unknown keys ride through on re-serialize so
 * round-trips stay lossless for unmodeled fields. Nothing here executes script bodies.
 */

export type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

/** One module-packaged trigger row (conditions + effects; may include triggerlua code effects). */
export interface RisuModuleTrigger {
  comment?: string;
  type?: string;
  conditions?: unknown[];
  effect?: unknown[];
  lowLevelAccess?: boolean;
  [key: string]: unknown;
}

/** One module-packaged regex (customScripts dialect). */
export interface RisuModuleRegex {
  comment?: string;
  in?: string;
  out?: string;
  type?: string;
  ableFlag?: boolean;
  [key: string]: unknown;
}

/** One module-packaged lorebook entry. */
export interface RisuModuleLore {
  key?: string[];
  secondkey?: string[];
  comment?: string;
  content?: string;
  mode?: string;
  alwaysActive?: boolean;
  selective?: boolean;
  [key: string]: unknown;
}

/**
 * Known top-level module fields plus an open bag for anything else Risu ships.
 * Script bodies (triggerlua code, etc.) stay plain strings - sealed cargo until the sandbox runs them.
 */
export interface RisuModule {
  name?: string;
  description?: string;
  id?: string;
  trigger?: RisuModuleTrigger[];
  regex?: RisuModuleRegex[];
  lorebook?: RisuModuleLore[];
  assets?: unknown;
  /** Any other top-level keys preserved for lossless re-serialize. */
  extras: Rec;
}

const KNOWN_KEYS = ["name", "description", "id", "trigger", "regex", "lorebook", "assets"] as const;

/** Pull every triggerlua / cjs effect body out of the trigger list (for Workshop code parts). */
export function listScriptEffects(
  mod: RisuModule,
): Array<{ kind: "triggerlua" | "cjs" | "triggercode"; code: string; triggerIndex: number; effectIndex: number }> {
  const out: Array<{
    kind: "triggerlua" | "cjs" | "triggercode";
    code: string;
    triggerIndex: number;
    effectIndex: number;
  }> = [];
  const triggers = mod.trigger ?? [];
  for (let ti = 0; ti < triggers.length; ti++) {
    const effects = triggers[ti]?.effect;
    if (!Array.isArray(effects)) continue;
    for (let ei = 0; ei < effects.length; ei++) {
      const row = effects[ei];
      if (!isRec(row)) continue;
      const type = typeof row.type === "string" ? row.type : "";
      const code = typeof row.code === "string" ? row.code : "";
      if (!code) continue;
      if (type === "triggerlua" || type === "cjs" || type === "triggercode") {
        out.push({ kind: type, code, triggerIndex: ti, effectIndex: ei });
      }
    }
  }
  return out;
}

/**
 * Parse a module JSON string into a RisuModule. Accepts a bare module object or Risu's envelope
 * `{ type: "risuModule", module: {...} }`. Tolerant: bad JSON throws; non-object root throws.
 */
export function parseModuleJson(json: string): RisuModule {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    throw new Error(`risum: module JSON.parse failed: ${(e as Error).message}`);
  }
  if (!isRec(raw)) throw new Error("risum: module root is not an object");
  const root = isRec(raw.module) ? raw.module : raw;

  const known = new Set<string>(KNOWN_KEYS);
  const extras: Rec = {};
  for (const [k, v] of Object.entries(root)) {
    if (!known.has(k)) extras[k] = v;
  }

  const asArr = <T,>(v: unknown): T[] | undefined => (Array.isArray(v) ? (v as T[]) : undefined);

  return {
    name: typeof root.name === "string" ? root.name : undefined,
    description: typeof root.description === "string" ? root.description : undefined,
    id: typeof root.id === "string" ? root.id : undefined,
    trigger: asArr<RisuModuleTrigger>(root.trigger),
    regex: asArr<RisuModuleRegex>(root.regex),
    lorebook: asArr<RisuModuleLore>(root.lorebook),
    assets: root.assets,
    extras,
  };
}

/** Build the inner module object (no envelope) for JSON.stringify. */
function moduleBody(mod: RisuModule): Rec {
  const body: Rec = { ...mod.extras };
  if (mod.name !== undefined) body.name = mod.name;
  if (mod.description !== undefined) body.description = mod.description;
  if (mod.id !== undefined) body.id = mod.id;
  if (mod.trigger !== undefined) body.trigger = mod.trigger;
  if (mod.regex !== undefined) body.regex = mod.regex;
  if (mod.lorebook !== undefined) body.lorebook = mod.lorebook;
  if (mod.assets !== undefined) body.assets = mod.assets;
  const ordered: Rec = {};
  for (const k of KNOWN_KEYS) {
    if (k in body) ordered[k] = body[k];
  }
  for (const [k, v] of Object.entries(body)) {
    if (!(k in ordered)) ordered[k] = v;
  }
  return ordered;
}

/**
 * Re-serialize a RisuModule to pretty JSON matching Risu's RPack payload:
 * `JSON.stringify({ module, type: "risuModule" }, null, 2)`.
 */
export function serializeModuleJson(mod: RisuModule): string {
  return JSON.stringify({ module: moduleBody(mod), type: "risuModule" }, null, 2);
}

/** Deterministic compare for "was this module edited?" (envelope-stable). */
export function modulesStructurallyEqual(a: RisuModule, b: RisuModule): boolean {
  return serializeModuleJson(a) === serializeModuleJson(b);
}
