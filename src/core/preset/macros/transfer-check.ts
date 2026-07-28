/**
 * "Will this preset's macros survive on that engine?" - the export-time question, answered against
 * the per-engine catalogs rather than a model's guess about macro names.
 *
 * WHAT THIS CAN PROVE TODAY, and no more. support.ts is NAME-level: a name missing from the target
 * engine is a reliable "this token dies there", but a name PRESENT is not a promise the syntax or
 * meaning matches. {{random::a::b}} exists on both SillyTavern and RoleCall and means different
 * things on each. So findings carry `dies` only, and `limits` states the gap in the report itself
 * instead of leaving a reader to assume a clean bill of health. Semantic-level findings need
 * MacroEntry to grow arity and meaning first; the shape here does not change when it does.
 *
 * Scope: the {{...}} dialect and the preset kind. Risu's [[name]] CBS and Agnai's named-slot
 * templates are not modeled (see ./index.ts for why), so an unmodeled target reports checked:false
 * rather than an empty, falsely reassuring finding list.
 */
import type { PresetWriteForProfile } from "../capabilities";
import { PRESET_WRITE_FOR_PROFILES } from "../capabilities";
import { scanMacroTokens, isMacroSupported, findMacro, pathSegment } from "./support";

/** One macro token that will not resolve on the target engine. */
export interface MacroFinding {
  /** The token exactly as authored. */
  token: string;
  /** Where it was found, as a human-readable location inside the preset. */
  where: string;
  /** Reliable today: the target engine has no macro of this name at all. */
  status: "dies";
  note: string;
}

export interface MacroTransferReport {
  /** The target lens, or null when that engine's dialect is not modeled. */
  target: PresetWriteForProfile | null;
  /** False when the target is unmodeled: absence of findings then proves nothing. */
  checked: boolean;
  findings: MacroFinding[];
  /** Honest caveats that travel with the result, never dropped by a caller. */
  limits: string[];
}

/**
 * The authoring lens an adapter id implies, for ANY entity kind.
 *
 * WHY THIS IS DERIVED AND NOT A TABLE. It used to list the four preset adapters by hand, which is
 * why macro checking only ever ran on presets: `sillytavern` (characters) and `rolecall-lorebook`
 * matched nothing, so every other kind crossed engines with no dialect check at all. Adapter ids are
 * `family` or `family-kind`, and the family IS the profile name, so reading the leading segment
 * covers every kind and every future codec without another edit.
 *
 * An unmodeled engine still resolves to null, which callers must render as "unknown", never "clean".
 */
export function profileForAdapter(adapterId: string): PresetWriteForProfile | null {
  const family = adapterId.split("-")[0] ?? "";
  return PRESET_WRITE_FOR_PROFILES.find((p) => p !== "full" && p === family) ?? null;
}

/**
 * An escrow key to the authoring lens it implies.
 *
 * CODECS KEY ESCROW TWO WAYS and both are correct, which is the whole reason this function exists
 * rather than a single lookup. Three preset codecs key by format FAMILY (`rolecall`, `sillytavern`,
 * `lumiverse`) because the family's character codec escrows under the same name; Marinara keys by
 * ADAPTER ID (`marinara-preset`). Resolving only adapter ids silently returned null for the other
 * three, which switched macro translation off for every real RoleCall preset - the flagship path.
 * Both spellings resolve here instead of churning an escrow shape that is already in users' files.
 *
 * `full` is excluded deliberately: it is the canonical lens, not a format anything escrows under.
 */
const profileForEscrowKey = (key: string): PresetWriteForProfile | null => profileForAdapter(key);

/**
 * Which engine's dialect a stored piece was authored in, read from its escrow keys, which are the
 * only durable record of where the text came from. A from-scratch piece has no escrow and resolves
 * to null, so a caller can decline to translate rather than guess a source dialect.
 */
export function sourceProfileOf(entity: unknown): PresetWriteForProfile | null {
  const original = (entity as { original?: Record<string, unknown> })?.original;
  if (!original) return null;
  for (const escrowKey of Object.keys(original)) {
    const profile = profileForEscrowKey(escrowKey);
    if (profile) return profile;
  }
  return null;
}

const NAME_LEVEL_LIMIT =
  "Name-level check only: a token absent from this list is not proof it behaves identically on the "
  + "target. Separators and meaning differ between engines (for example {{random::a::b}} picks from "
  + "a list on SillyTavern but is a numeric range on RoleCall).";

const SCOPE_LIMIT =
  "Every authored string in the canonical body was scanned. Macro text inside escrowed "
  + "platform-native fields was not: escrow is the sealed source record and is never rewritten.";

/**
 * Every authored string in a body, with the path it was found at.
 *
 * WHY A WALK AND NOT A FIELD LIST. This read `body.prompts[].content` only, which is why macro
 * checking was a preset-only feature: a character's greetings, a lorebook entry's content, and a
 * persona's description all carry macros and none of them were ever looked at. Walking the body
 * finds them wherever an author put them, including in fields no codec has invented yet.
 *
 * `original` is skipped deliberately - escrow is the untouched source and must stay that way - and
 * so are strings with no `{{`, which is the overwhelming majority and keeps the walk cheap on
 * bodies carrying base64 media.
 */
export function authoredTexts(body: unknown): { text: string; where: string }[] {
  const out: { text: string; where: string }[] = [];
  const seen = new Set<object>();

  const walk = (node: unknown, path: string): void => {
    if (typeof node === "string") {
      if (node.includes("{{")) out.push({ text: node, where: path || "body" });
      return;
    }
    if (node === null || typeof node !== "object") return;
    if (seen.has(node)) return; // a cycle would otherwise walk forever
    seen.add(node);
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${pathSegment(item, index)}]`));
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === "original") continue;
      walk(value, path ? `${path}.${key}` : key);
    }
  };

  walk(body, "");
  return out;
}

/**
 * Check one canonical body against a target adapter, for ANY entity kind. An unmodeled target
 * returns checked:false with no findings, which a caller must render as "unknown", never "clean".
 */
export function checkMacroTransfer(
  body: unknown,
  targetAdapterId: string,
): MacroTransferReport {
  const target = profileForAdapter(targetAdapterId);
  if (!target) {
    return {
      target: null,
      checked: false,
      findings: [],
      limits: [
        `The macro dialect for "${targetAdapterId}" is not modeled, so no macro check ran. Absence `
        + "of findings here is not a compatibility claim.",
      ],
    };
  }
  const findings: MacroFinding[] = [];
  const seen = new Set<string>();
  for (const { text, where } of authoredTexts(body)) {
    for (const token of scanMacroTokens(text)) {
      // NUL joins the pair because it is the one byte neither a block name nor a macro token can
      // contain, so two different pairs can never collide on one key. Written as an ESCAPE, never
      // as a raw control byte: an invisible NUL in source makes git treat this whole file as
      // binary, which silently costs every future change its diff.
      const key = `${where}\u0000${token}`;
      if (seen.has(key) || isMacroSupported(target, token)) continue;
      seen.add(key);
      const known = findMacro(target, token);
      findings.push({
        token,
        where,
        status: "dies",
        note: known
          ? `Resolves to ${known.macro} on this engine.`
          : "No macro of this name exists on the target engine; it will stay literal text.",
      });
    }
  }
  return { target, checked: true, findings, limits: [NAME_LEVEL_LIMIT, SCOPE_LIMIT] };
}
