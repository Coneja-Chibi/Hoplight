/**
 * Risu `extensions.risuai` scalar field mapping (wire <-> canonical). Only the Risu family carries this
 * block, so the mapping lives in the risu folder; the shared Tavern mapper never touches it. Covers the
 * authored NON-executable surface: license, bias, additionalText, display/behavior toggles, image-gen
 * hints (sdData/newGenData), and the vits voice config. The executable behavior surface (customScripts,
 * triggerscript, virtualscript, backgroundHTML/CSS) is modeled by the upcoming behavior/regex entities,
 * NOT here and NOT original-forever; until that slice lands it rides the raw twin, flagged via
 * hasExecutableContent. Field shapes verified against the real cherry.card.json sample
 * (samples/risu/SOURCES.md), extracted clean-room from card DATA, never Risu source.
 */
import type {
  CharacterBehavior,
  CharacterBody,
  ImagePrompt,
  TriggerScript,
  Voice,
} from "../../entities/character/schema";
import type { TavernData } from "../_shared/tavern-fields";
import { readRegexScripts, regexScriptsToWire } from "./regex";

export { readRegexScripts, regexScriptsToWire } from "./regex";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

/** The card's risuai block, or {} (read-only view; never mutate the result of this). */
const risuaiOf = (data: TavernData): Rec => {
  const ext = isRec(data.extensions) ? data.extensions : {};
  return isRec(ext.risuai) ? (ext.risuai as Rec) : {};
};

const presentStr = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;
const presentBool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);

/** risuai.bias is [phrase, weight] tuple pairs; empty/malformed pairs drop; empty list -> undefined. */
function readBias(v: unknown): { phrase: string; weight: number }[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter((p): p is [unknown, unknown] => Array.isArray(p) && p.length >= 2)
    .filter((p): p is [string, number] => typeof p[0] === "string" && typeof p[1] === "number")
    .map(([phrase, weight]) => ({ phrase, weight }));
  return out.length > 0 ? out : undefined;
}

/** sdData ([label, value] rows) + newGenData -> canonical ImagePrompt; undefined when nothing authored. */
function readImagePrompt(r: Rec): ImagePrompt | undefined {
  const out: ImagePrompt = {};
  if (Array.isArray(r.sdData)) {
    const rows = r.sdData
      .filter((p): p is [unknown, unknown] => Array.isArray(p) && p.length >= 2)
      .filter((p): p is [string, string] => typeof p[0] === "string" && typeof p[1] === "string")
      .map(([label, value]) => ({ label, value }));
    if (rows.length > 0) out.rows = rows;
  }
  const g = isRec(r.newGenData) ? r.newGenData : {};
  if (presentStr(g.prompt)) out.prompt = g.prompt as string;
  if (presentStr(g.negative)) out.negative = g.negative as string;
  if (presentStr(g.instructions)) out.instructions = g.instructions as string;
  if (presentStr(g.emotionInstructions)) out.emotionInstructions = g.emotionInstructions as string;
  return Object.keys(out).length > 0 ? out : undefined;
}

/** vits config -> narrow Voice. Only vits actually serializes on the Risu wire (A2 census correction). */
function readVoice(r: Rec): Voice | undefined {
  if (!isRec(r.vits) || Object.keys(r.vits).length === 0) return undefined;
  return { provider: "vits", extras: { config: r.vits } };
}

/** risuai display/behavior toggles -> settings.risu group; undefined when none present on the wire. */
function readToggles(r: Rec): NonNullable<CharacterBody["settings"]>["risu"] {
  const out: NonNullable<CharacterBody["settings"]>["risu"] = {};
  if (typeof r.viewScreen === "string") out.viewScreen = r.viewScreen;
  const b = (k: "largePortrait" | "inlayViewScreen" | "utilityBot" | "lorePlus"): void => {
    const v = presentBool(r[k]);
    if (v !== undefined) out[k] = v;
  };
  b("largePortrait");
  b("inlayViewScreen");
  b("utilityBot");
  b("lorePlus");
  return Object.keys(out).length > 0 ? out : undefined;
}

// -- authored behavior (scripts): first-class editable DATA, never executed (see CharacterBehavior) --
// readRegexScripts/regexScriptsToWire moved to ./regex (REGEX-JEWEL-PLAN.md R1), re-exported above.

/** triggerscript wire rows -> TriggerScript[] (condition/effect rows carried verbatim-editable). */
function readTriggerScripts(v: unknown): TriggerScript[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter(isRec).map((s): TriggerScript => {
    const t: TriggerScript = {
      event: typeof s.type === "string" ? s.type : "",
      conditions: Array.isArray(s.conditions) ? s.conditions : [],
      effects: Array.isArray(s.effect) ? s.effect : [],
    };
    if (typeof s.comment === "string") t.label = s.comment;
    return t;
  });
  return out.length > 0 ? out : undefined;
}

const triggerScriptsToWire = (list: TriggerScript[]): Rec[] =>
  list.map((t) => ({
    comment: t.label ?? "",
    type: t.event,
    conditions: t.conditions,
    effect: t.effects, // wire key is singular
  }));

/** The whole authored behavior surface -> CharacterBehavior (undefined when nothing authored). */
function readBehavior(r: Rec): CharacterBehavior | undefined {
  const out: CharacterBehavior = {};
  const regex = readRegexScripts(r.customScripts);
  if (regex) out.regexScripts = regex;
  const triggers = readTriggerScripts(r.triggerscript);
  if (triggers) out.triggerScripts = triggers;
  if (presentStr(r.virtualscript)) out.virtualScript = r.virtualscript as string;
  if (presentStr(r.backgroundHTML)) out.backgroundHTML = r.backgroundHTML as string;
  if (presentStr(r.backgroundCSS)) out.backgroundCSS = r.backgroundCSS as string;
  if (presentStr(r.defaultVariables)) out.defaultVariables = r.defaultVariables as string;
  const pre: NonNullable<CharacterBehavior["prebuiltAsset"]> = {};
  if (presentStr(r.prebuiltAssetCommand)) pre.command = r.prebuiltAssetCommand as string;
  if (Array.isArray(r.prebuiltAssetExclude)) {
    pre.exclude = r.prebuiltAssetExclude.filter((x): x is string => typeof x === "string");
  }
  if (presentStr(r.prebuiltAssetStyle)) pre.style = r.prebuiltAssetStyle as string;
  if (Object.keys(pre).length > 0) out.prebuiltAsset = pre;
  // Risu wire key is `toggles` (export createBaseV3 / import reads toggles). DB field name is
  // customModuleToggle. Accept both on read so old VVS writes and real Risu cards both load.
  if (presentStr(r.toggles)) out.moduleToggles = r.toggles as string;
  else if (presentStr(r.customModuleToggle)) out.moduleToggles = r.customModuleToggle as string;
  if (typeof r.lowLevelAccess === "boolean") out.privileged = r.lowLevelAccess;
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Read the authored risuai scalar surface into canonical slots (mutates body in place). */
export function applyRisuToBody(data: TavernData, body: CharacterBody): void {
  const r = risuaiOf(data);
  body.attribution.license = presentStr(r.license) ?? body.attribution.license;
  body.bias = readBias(r.bias);
  const additionalText = presentStr(r.additionalText);
  if (additionalText !== undefined) body.prompts.additionalText = additionalText;
  const toggles = readToggles(r);
  if (toggles) body.settings = { ...(body.settings ?? {}), risu: toggles };
  body.persona.imagePrompt = readImagePrompt(r);
  body.persona.voice = readVoice(r);
  body.behavior = readBehavior(r);
}

const deepEq = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Write the canonical slots back into `data.extensions.risuai`, diffing each against the twin's decode
 * so an unedited card stays byte-identical (the stale-twin trap: a skipped write hides behind a green
 * round-trip). `data` is the CLONED twin at call time, so its risuai still holds the original values.
 */
export function applyBodyToRisu(data: TavernData, body: CharacterBody): void {
  const twin = risuaiOf(data);
  const decoded: CharacterBody = {
    identity: { name: "" },
    persona: {},
    prompts: {},
    greetings: {},
    examples: {},
    media: {},
    attribution: {},
    discovery: {},
  };
  applyRisuToBody(data, decoded);

  const writes: Rec = {};
  // Twin-diff a scalar: write it when the canonical value changed, and mark its wire key for deletion
  // when the twin carried it but canonical has since cleared it. The character editor clears a text
  // field by DROPPING the key (writePath treats "" as empty and deletes), so the canonical value goes
  // undefined, not "". A set-only mapping would leak the stale twin value straight back out.
  const deletes: string[] = [];
  const scalar = (wireKey: string, val: string | undefined, dec: string | undefined): void => {
    if (val !== undefined && val !== dec) writes[wireKey] = val;
    else if (val === undefined && dec !== undefined) deletes.push(wireKey);
  };
  scalar("license", body.attribution.license, decoded.attribution.license);
  if (body.bias !== undefined && !deepEq(body.bias, decoded.bias)) {
    writes.bias = body.bias.map((b) => [b.phrase, b.weight]);
  }
  scalar("additionalText", body.prompts.additionalText, decoded.prompts.additionalText);
  const t = body.settings?.risu;
  if (t && !deepEq(t, decoded.settings?.risu)) {
    if (t.viewScreen !== undefined) writes.viewScreen = t.viewScreen;
    if (t.largePortrait !== undefined) writes.largePortrait = t.largePortrait;
    if (t.inlayViewScreen !== undefined) writes.inlayViewScreen = t.inlayViewScreen;
    if (t.utilityBot !== undefined) writes.utilityBot = t.utilityBot;
    if (t.lorePlus !== undefined) writes.lorePlus = t.lorePlus;
  }
  const ip = body.persona.imagePrompt;
  if (ip && !deepEq(ip, decoded.persona.imagePrompt)) {
    if (ip.rows) writes.sdData = ip.rows.map((row) => [row.label, row.value]);
    const gen: Rec = { ...(isRec(twin.newGenData) ? twin.newGenData : {}) };
    if (ip.prompt !== undefined) gen.prompt = ip.prompt;
    if (ip.negative !== undefined) gen.negative = ip.negative;
    if (ip.instructions !== undefined) gen.instructions = ip.instructions;
    if (ip.emotionInstructions !== undefined) gen.emotionInstructions = ip.emotionInstructions;
    if (Object.keys(gen).length > 0) writes.newGenData = gen;
    // prefix/suffix/template (Agnai affixes) have no Risu wire home and are not written here.
  }
  const v = body.persona.voice;
  if (v?.provider === "vits" && !deepEq(v, decoded.persona.voice)) {
    writes.vits = isRec(v.extras?.config) ? v.extras.config : {};
  }
  const beh = body.behavior;
  if (beh && !deepEq(beh, decoded.behavior)) {
    const d = decoded.behavior;
    if (beh.regexScripts && !deepEq(beh.regexScripts, d?.regexScripts)) {
      writes.customScripts = regexScriptsToWire(beh.regexScripts);
    }
    if (beh.triggerScripts && !deepEq(beh.triggerScripts, d?.triggerScripts)) {
      writes.triggerscript = triggerScriptsToWire(beh.triggerScripts);
    }
    scalar("virtualscript", beh.virtualScript, d?.virtualScript);
    scalar("backgroundHTML", beh.backgroundHTML, d?.backgroundHTML);
    scalar("backgroundCSS", beh.backgroundCSS, d?.backgroundCSS);
    scalar("defaultVariables", beh.defaultVariables, d?.defaultVariables);
    // Write the producer wire key `toggles` (not the DB-only name customModuleToggle).
    scalar("toggles", beh.moduleToggles, d?.moduleToggles);
    if (beh.prebuiltAsset && !deepEq(beh.prebuiltAsset, d?.prebuiltAsset)) {
      if (beh.prebuiltAsset.command !== undefined) writes.prebuiltAssetCommand = beh.prebuiltAsset.command;
      if (beh.prebuiltAsset.exclude !== undefined) writes.prebuiltAssetExclude = beh.prebuiltAsset.exclude;
      if (beh.prebuiltAsset.style !== undefined) writes.prebuiltAssetStyle = beh.prebuiltAsset.style;
    }
    if (beh.privileged !== undefined && beh.privileged !== d?.privileged) {
      writes.lowLevelAccess = beh.privileged;
    }
  }

  if (Object.keys(writes).length === 0 && deletes.length === 0) return;
  if (!isRec(data.extensions)) data.extensions = {};
  const ext = data.extensions as Rec;
  const risuai = { ...(isRec(ext.risuai) ? ext.risuai : {}), ...writes };
  for (const key of deletes) delete risuai[key];
  ext.risuai = risuai;
}
