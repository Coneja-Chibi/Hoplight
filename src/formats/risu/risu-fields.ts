/**
 * Risu `extensions.risuai` scalar field mapping (wire <-> canonical). Only the Risu family carries this
 * block, so the mapping lives in the risu folder; the shared Tavern mapper never touches it. Covers the
 * authored NON-executable surface: license, bias, additionalText, display/behavior toggles, image-gen
 * hints (sdData/newGenData), and the vits voice config. The executable behavior surface (customScripts,
 * triggerscript, virtualscript, backgroundHTML/CSS) is modeled by the upcoming behavior/regex entities,
 * NOT here and NOT escrow-forever; until that slice lands it rides the raw twin, flagged via
 * hasExecutableContent. Field shapes verified against the real cherry.card.json sample
 * (samples/risu/SOURCES.md), extracted clean-room from card DATA, never Risu source.
 */
import type { CharacterBody, ImagePrompt, Voice } from "../../entities/character/schema";
import type { TavernData } from "../_shared/tavern-fields";

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
  if (body.attribution.license !== undefined && body.attribution.license !== decoded.attribution.license) {
    writes.license = body.attribution.license;
  }
  if (body.bias !== undefined && !deepEq(body.bias, decoded.bias)) {
    writes.bias = body.bias.map((b) => [b.phrase, b.weight]);
  }
  if (
    body.prompts.additionalText !== undefined &&
    body.prompts.additionalText !== decoded.prompts.additionalText
  ) {
    writes.additionalText = body.prompts.additionalText;
  }
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

  if (Object.keys(writes).length === 0) return;
  if (!isRec(data.extensions)) data.extensions = {};
  const ext = data.extensions as Rec;
  ext.risuai = { ...(isRec(ext.risuai) ? ext.risuai : {}), ...writes };
}
