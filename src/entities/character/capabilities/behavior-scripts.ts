/**
 * Semantic list operations for card-embedded regex and trigger scripts.
 * Script payloads remain sealed data: this module only clones, overlays, reorders, and previews.
 */
import { z } from "zod";
import type { CapabilityChange, ContentCapability } from "../../capabilities";
import type {
  CanonicalCharacter,
  CharacterBody,
  RegexScript,
  TriggerScript,
} from "../schema";
import { readCharacterPath, writeCharacterPath } from "./operations";
import { nonEmptyPatch, targetSchema } from "./shared";

const regexScript = z.strictObject({
  label: z.string().optional(),
  find: z.string(),
  replace: z.string(),
  phase: z.string(),
  flags: z.string().optional(),
  useFlags: z.boolean().optional(),
});
const triggerScript = z.strictObject({
  label: z.string().optional(),
  event: z.string(),
  conditions: z.array(z.unknown()),
  effects: z.array(z.unknown()),
});
const regexPatch = nonEmptyPatch({
  label: z.string().nullable().optional(),
  find: z.string().optional(),
  replace: z.string().optional(),
  phase: z.string().optional(),
  flags: z.string().nullable().optional(),
  useFlags: z.boolean().nullable().optional(),
});
const triggerPatch = nonEmptyPatch({
  label: z.string().nullable().optional(),
  event: z.string().optional(),
  conditions: z.array(z.unknown()).optional(),
  effects: z.array(z.unknown()).optional(),
});
const index = z.number().int().nonnegative();
const operation = z.union([
  z.strictObject({ type: z.literal("add"), scriptKind: z.literal("regex"), at: index.optional(), script: regexScript }),
  z.strictObject({ type: z.literal("add"), scriptKind: z.literal("trigger"), at: index.optional(), script: triggerScript }),
  z.strictObject({ type: z.literal("update"), scriptKind: z.literal("regex"), index, patch: regexPatch }),
  z.strictObject({ type: z.literal("update"), scriptKind: z.literal("trigger"), index, patch: triggerPatch }),
  z.strictObject({ type: z.literal("remove"), scriptKind: z.enum(["regex", "trigger"]), index }),
  z.strictObject({ type: z.literal("move"), scriptKind: z.enum(["regex", "trigger"]), index, to: index }),
]);
const input = z.strictObject({ target: targetSchema, operation });
type Operation = z.infer<typeof operation>;
type Script = RegexScript | TriggerScript;

const pathFor = (kind: "regex" | "trigger"): string =>
  kind === "regex" ? "behavior.regexScripts" : "behavior.triggerScripts";

function listAt(body: CharacterBody, kind: "regex" | "trigger"): Script[] {
  const value = readCharacterPath(body, pathFor(kind));
  return Array.isArray(value) ? value as Script[] : [];
}

function requiredAt(list: readonly Script[], position: number): Script {
  const script = list[position];
  if (!script) throw new Error(`behavior script index ${position} does not exist`);
  return script;
}

function overlay(script: Script, patch: Readonly<Record<string, unknown>>): Script {
  const next: Record<string, unknown> = { ...script };
  for (const [field, value] of Object.entries(patch)) {
    if (value === null) delete next[field];
    else next[field] = structuredClone(value);
  }
  return next as unknown as Script;
}

function applyOperation(body: CharacterBody, action: Operation): CharacterBody {
  const list = listAt(body, action.scriptKind);
  let next: Script[];
  if (action.type === "add") {
    const at = action.at ?? list.length;
    if (at > list.length) throw new Error(`behavior script insertion ${at} is out of range`);
    next = [...list.slice(0, at), structuredClone(action.script), ...list.slice(at)];
  } else if (action.type === "update") {
    requiredAt(list, action.index);
    next = list.map((script, position) =>
      position === action.index ? overlay(script, action.patch) : script);
  } else if (action.type === "remove") {
    requiredAt(list, action.index);
    next = list.filter((_, position) => position !== action.index);
  } else {
    requiredAt(list, action.index);
    if (action.to >= list.length) throw new Error(`behavior script destination ${action.to} is out of range`);
    next = [...list];
    const [moved] = next.splice(action.index, 1);
    next.splice(action.to, 0, moved!);
  }
  return writeCharacterPath(
    body as unknown as Record<string, unknown>,
    pathFor(action.scriptKind),
    next,
  ) as unknown as CharacterBody;
}

function changedIndex(action: Operation): number {
  if (action.type === "add") return action.at ?? -1;
  if (action.type === "move") return action.to;
  return action.index;
}

const capability: ContentCapability<z.infer<typeof input>, CanonicalCharacter> = {
  id: "character.behavior-scripts.manage",
  kind: "character",
  area: "behavior",
  action: "manage scripts",
  summary: "Add, edit, remove, or reorder sealed card-embedded regex and trigger script data.",
  aliases: ["inline regex", "trigger script", "card automation", "reorder behavior"],
  platforms: "canonical",
  exposure: "deferred",
  effect: "draft",
  input,
  concurrencyKey: ({ target }) => `character/${target.id}`,
  preview: (entity, { operation: action }) => {
    if (action.scriptKind === "regex" && action.type === "update") {
      regexPatch.parse(action.patch);
    }
    if (action.scriptKind === "trigger" && action.type === "update") {
      triggerPatch.parse(action.patch);
    }
    const before = listAt(entity.body, action.scriptKind);
    const body = applyOperation(entity.body, action);
    const after = listAt(body, action.scriptKind);
    const location = changedIndex(action);
    const change: CapabilityChange = {
      path: `body.${pathFor(action.scriptKind)}[${location < 0 ? after.length - 1 : location}]`,
      label: `${action.type} ${action.scriptKind} script`,
      before,
      after,
    };
    return {
      entity: { ...entity, body },
      changes: [change],
      warnings: [],
      platformImpact: [],
    };
  },
};

export default capability;
