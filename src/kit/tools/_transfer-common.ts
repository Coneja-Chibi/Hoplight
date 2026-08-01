/**
 * The one conversion path shared by preview (`studio_transfer`) and write (`studio_export`).
 *
 * Extracted rather than duplicated because these two tools must never disagree: a preview that
 * reported different losses than the write actually incurred would be worse than having no preview.
 * One function serializes, one function reports, both tools call them.
 *
 * The conversion graph is imported lazily and must stay that way. `discover.ts` imports every tool
 * file at session start, so a static import of `convert.ts` drags the whole adapter and codec graph
 * into Kit's cold start for work most turns never do.
 */
import type { KitBridge, KitEntity } from "../bridge";
import type { MacroTransferReport } from "../../core/preset/macros/transfer-check";
import type { MacroChange } from "../../core/preset/macros/translate";
import type { StructuralFindings } from "../../core/preset/macros/structure";
import type { Observation } from "../../core/preset/macros/explain";
import type { HookRendering } from "../../core/preset/macros/hooks-to-regex";
import type { Promotion } from "../../core/preset/macros/promote-markers";
import type { ProducerFix, UnfixedCleanup } from "../../core/preset/macros/fix-producer";

type ConversionKit = {
  registry: typeof import("../../core").registry;
  emitBundle: typeof import("../../convert").emitBundle;
  buildSerializeReport: typeof import("../../core").buildSerializeReport;
  checkMacroTransfer: typeof import("../../core/preset/macros/transfer-check").checkMacroTransfer;
  profileForAdapter: typeof import("../../core/preset/macros/transfer-check").profileForAdapter;
  sourceProfileOf: typeof import("../../core/preset/macros/transfer-check").sourceProfileOf;
  translatePresetBody: typeof import("../../core/preset/macros/translate").translatePresetBody;
  readPresetStructure: typeof import("../../core/preset/macros/structure").readPresetStructure;
  explainEntity: typeof import("../../core/preset/macros/explain").explainEntity;
  renderHooksAsRegex: typeof import("../../core/preset/macros/hooks-to-regex").renderHooksAsRegex;
  readStateMachine: typeof import("../../core/preset/macros/state-machine").readStateMachine;
  promoteMarkers: typeof import("../../core/preset/macros/promote-markers").promoteMarkers;
  fixProducers: typeof import("../../core/preset/macros/fix-producer").fixProducers;
};

/** Pull the conversion graph in on first use, with every adapter registered for this runtime. */
export async function loadConversionKit(): Promise<ConversionKit> {
  const [core, convert, macros, translate, structure, explain, hooks, state, markers, producers, formats] =
    await Promise.all([
    import("../../core"),
    import("../../convert"),
    import("../../core/preset/macros/transfer-check"),
    import("../../core/preset/macros/translate"),
    import("../../core/preset/macros/structure"),
    import("../../core/preset/macros/explain"),
    import("../../core/preset/macros/hooks-to-regex"),
    import("../../core/preset/macros/state-machine"),
    import("../../core/preset/macros/promote-markers"),
    import("../../core/preset/macros/fix-producer"),
    import("../../ensure-formats"),
  ]);
  await formats.ensureFormats();
  return {
    registry: core.registry,
    emitBundle: convert.emitBundle,
    buildSerializeReport: core.buildSerializeReport,
    checkMacroTransfer: macros.checkMacroTransfer,
    profileForAdapter: macros.profileForAdapter,
    sourceProfileOf: macros.sourceProfileOf,
    translatePresetBody: translate.translatePresetBody,
    readPresetStructure: structure.readPresetStructure,
    explainEntity: explain.explainEntity,
    renderHooksAsRegex: hooks.renderHooksAsRegex,
    readStateMachine: state.readStateMachine,
    promoteMarkers: markers.promoteMarkers,
    fixProducers: producers.fixProducers,
  };
}

export interface ConversionRefusal {
  ok: false;
  /** Terminal-line reason, already phrased for a reader. */
  reason: string;
  detail: string;
}

export interface ConversionSuccess {
  ok: true;
  /** The serialized wire text. */
  payload: string;
  /** Null when the adapter emitted binary; callers that must write a file refuse on this. */
  text: string | null;
  suggestedExtension: string;
  loss: ReturnType<ConversionKit["buildSerializeReport"]>;
  macros?: MacroTransferReport;
  /** Every macro actually rewritten, flattened, substituted, dropped or flagged on the way out. */
  translation?: MacroChange[];
  /**
   * The shape of the source's logic: arrays, closed domains, push hooks, choice groups, markers.
   * Computed facts only. What to DO about them is judgment, which the receipt leaves to its reader.
   */
  structure?: StructuralFindings;
  /**
   * Stated conclusions about how the source works, computed rather than left for a reader to
   * infer. A parts list can be fully correct while the whole is dead; these say what the parts add
   * up to, and which of it a conversion can silently destroy.
   */
  explanation?: Observation[];
  /**
   * The source hook machine rendered as regex rules the target can run, when the crossing needs it.
   * Kit does not write these: they are an artifact for a person or model to place, because adding
   * rules to a target is a structural edit this path does not own.
   */
  hookRules?: HookRendering;
  /**
   * Rules whose replacement uses something the destination engine does not execute.
   *
   * THE EDITOR ALREADY SHOWS THIS AND THAT WAS NOT ENOUGH. `travelLint` was reachable only from the
   * rule page, so a set converted by Kit crossed with nothing said. The likeliest case is also the
   * quietest: Hoplight's own engine runs JavaScript's `$&`, so it is natural to author, works while
   * being edited, and stops working the moment the set is written for another platform.
   */
  ruleNotes?: RuleTravelNote[];
  /**
   * Blocks that were SPLIT so a splice macro could become the structural block the target uses.
   * A restructuring of the user's prompt list is never silent.
   */
  promotions?: Promotion[];
  /**
   * Inline cleanup macros removed by repairing the writes that made them necessary, and the ones
   * that could not be traced to a producer, with reasons.
   */
  producerFixes?: { fixed: ProducerFix[]; unfixed: UnfixedCleanup[] };
  /** The dialects this crossing went between, when both were known. */
  dialect?: { from: string; to: string };
}

/** One rule carrying something the destination will not run, named for a reader. */
export interface RuleTravelNote {
  /** the rule's own id, so a receipt can point at which one */
  readonly id: string;
  /** the rule's label, because an id alone is not something a person recognises */
  readonly label: string;
  /** already phrased for a reader; names the consequence, not the rule violated */
  readonly reason: string;
}

export type ConversionOutcome = ConversionRefusal | ConversionSuccess;

/**
 * Lint a regex set against the engine it is being written for.
 *
 * Only the crossing is reported. `travelLint` returns nothing for the "full" lens by design (a rule
 * never travels to itself), so a same-engine round trip is silent without needing a special case
 * here. An adapter whose family is not a modelled lens yields nothing rather than a false all-clear;
 * the caller renders an absent field as "not checked", never as "clean".
 */
async function lintRegexTravel(entity: KitEntity, to: string): Promise<RuleTravelNote[]> {
  const [{ travelLint }, { isRegexWriteForProfile }] = await Promise.all([
    import("../../core/regex/travel-lint"),
    import("../../core/regex/capabilities"),
  ]);
  const family = to.split("-")[0] ?? "";
  if (!isRegexWriteForProfile(family)) return [];

  const rules = (entity as unknown as { body?: { rules?: unknown } }).body?.rules;
  if (!Array.isArray(rules)) return [];

  const notes: RuleTravelNote[] = [];
  for (const rule of rules) {
    for (const note of travelLint(rule as never, family)) {
      notes.push({
        id: String((rule as { id?: unknown }).id ?? ""),
        label: String((rule as { label?: unknown }).label ?? ""),
        reason: note.message,
      });
    }
  }
  return notes;
}

/** Adapter ids that can serialize this entity kind, for a failure message worth reading. */
export function targetsFor(kit: ConversionKit, kind: string): string {
  return kit.registry.all()
    .filter((adapter) => adapter.kind === kind)
    .map((adapter) => adapter.id)
    .sort()
    .join(", ");
}

/**
 * Convert one stored piece through a target adapter. Every refusal is a value, never a throw, so a
 * caller renders it as an ordinary outcome. A character carries its resolved lorebooks across.
 */
export async function convertStoredPiece(
  kit: ConversionKit,
  bridge: KitBridge,
  entity: KitEntity,
  kind: string,
  to: string,
): Promise<ConversionOutcome> {
  const target = kit.registry.get(to);
  if (!target) {
    return {
      ok: false,
      reason: "unknown target",
      detail: `No format adapter with id "${to}". Targets for ${kind}: ${targetsFor(kit, kind)}`,
    };
  }
  if (target.kind !== kind) {
    return {
      ok: false,
      reason: "wrong kind",
      detail:
        `"${to}" writes ${target.kind} files and cannot carry a ${kind}. `
        + `Targets for ${kind}: ${targetsFor(kit, kind)}`,
    };
  }

  // Translate the dialect BEFORE serializing, so the emitted file carries macros the target can
  // actually run rather than RoleCall syntax wearing a SillyTavern filename. Only when both ends
  // are modelled and genuinely different; a same-dialect or unknown-dialect crossing is left alone
  // rather than guessed at.
  //
  // THIS IS NOT PRESET-ONLY, and gating it on `kind === "preset"` was a real hole rather than a
  // scoping decision: a character's greetings and example messages, a lorebook entry's content and a
  // persona's description all carry macros, and every one of them crossed engines with no dialect
  // check and no translation. Fourteen characters in one real studio carry 295 macro tokens between
  // them. They happened to be {{user}} and {{char}}, which survive anywhere - that was luck, not
  // safety.
  let subject = entity;
  let translation: MacroChange[] | undefined;
  let dialect: { from: string; to: string } | undefined;
  let promotions: Promotion[] | undefined;
  let producerFixes: { fixed: ProducerFix[]; unfixed: UnfixedCleanup[] } | undefined;
  const fromProfile = kit.sourceProfileOf(entity);
  const toProfile = kit.profileForAdapter(to);
  if (fromProfile && toProfile && fromProfile !== toProfile) {
    // PROMOTION RUNS FIRST, and the order is not arbitrary. A macro with no home on the target is
    // REMOVED by the translator, so by the time translation has finished there is nothing left to
    // promote - the transcript splice would already be gone, honestly reported as a removal and
    // just as absent. So the dead tokens are read off the ORIGINAL body and the structural split
    // happens before any text is rewritten.
    const doomed = kit.checkMacroTransfer((entity as unknown as { body?: unknown }).body, to)
      .findings.map((finding) => finding.token);
    const promoted = kit.promoteMarkers((entity as unknown as { body?: unknown }).body, doomed);
    if (promoted.promotions.length > 0) promotions = promoted.promotions;

    // Repair inline cleanup macros the same way and for the same reason: the translator would
    // otherwise delete them as unsupported, taking the cleaning with them, and the value would
    // render with the leading separator the macro existed to strip.
    const repaired = kit.fixProducers(promoted.body);
    if (repaired.fixes.length > 0 || repaired.unfixed.length > 0) {
      producerFixes = { fixed: repaired.fixes, unfixed: repaired.unfixed };
    }

    const result = kit.translatePresetBody(repaired.body, fromProfile, toProfile);
    subject = { ...(entity as object), body: result.body } as KitEntity;
    translation = result.changes;
    dialect = { from: fromProfile, to: toProfile };
  }

  try {
    const out = kind === "character"
      ? kit.emitBundle(
          target as Parameters<ConversionKit["emitBundle"]>[0],
          subject as unknown as Parameters<ConversionKit["emitBundle"]>[1],
          (await resolveKnowledge(bridge, entity)) as unknown as Parameters<ConversionKit["emitBundle"]>[2],
        )
      : (target.fromCanonical as (e: unknown) => ReturnType<ConversionKit["emitBundle"]>)(subject);

    const loss = out.report ?? kit.buildSerializeReport(subject, target);
    const text = out.text ?? null;
    // Report macro survival against what is ACTUALLY being emitted, not the untranslated original.
    // Every kind is checked; an unmodeled target still reports checked:false rather than silence.
    const macros = kit.checkMacroTransfer((subject as unknown as { body?: unknown }).body, to);

    // A macro with no home on the target is either one the translator REMOVED or one still
    // unresolvable in the emitted text. Both belong here: a removed token is gone from the body, so
    // reading the findings alone would offer no marker candidate for exactly the tokens that need
    // one most - the real preset's {{message_history}} is removed, and it is the promotion case.
    const dead = [
      ...(translation ?? [])
        .filter((change) => change.kind === "absent")
        .map((change) => ({ token: change.from, where: change.where })),
      ...(macros?.findings ?? []).map((finding) => ({ token: finding.token, where: finding.where })),
    ];

    // Structure describes the SOURCE. The translated copy has already had its arrays lowered and its
    // dead macros stripped, so reading structure off it would report a preset with no logic in it.
    const structure = kind === "preset" ? kit.readPresetStructure(entity, dead) : undefined;
    // Not preset-gated: a lorebook's activation rules and a regex set's state writes are exactly
    // as load-bearing, and exactly as easy for a conversion to drop without saying so.
    const explanation = kit.explainEntity(entity, kind);

    // A hook machine has no counterpart in the emitted preset file: the target keeps its state
    // rules somewhere else entirely. Rendering them here means the crossing arrives with the second
    // half of itself rather than leaving the logic behind and saying nothing. Only when the dialect
    // actually changes - a same-engine round trip already has its hooks.
    // A regex set is the case the editor's lint could never reach from here: Hoplight runs $& , so a
    // rule using it works while authored and breaks on arrival. Checked on the SOURCE rules, which
    // are what the adapter is about to write out.
    const ruleNotes = kind === "regex" ? await lintRegexTravel(entity, to) : [];

    const machine = dialect ? kit.readStateMachine(escrowedHookYaml(entity)) : null;
    const hookRules = machine && machine.hooks.length > 0
      ? kit.renderHooksAsRegex(machine)
      : undefined;

    return {
      ok: true,
      text,
      payload: text ?? `<${out.bytes?.byteLength ?? 0} bytes of ${out.suggestedExtension}>`,
      suggestedExtension: out.suggestedExtension,
      loss,
      ...(macros ? { macros } : {}),
      ...(translation ? { translation } : {}),
      ...(structure ? { structure } : {}),
      ...(explanation?.length ? { explanation } : {}),
      ...(hookRules ? { hookRules } : {}),
      ...(ruleNotes.length > 0 ? { ruleNotes } : {}),
      ...(promotions ? { promotions } : {}),
      ...(producerFixes ? { producerFixes } : {}),
      ...(dialect ? { dialect } : {}),
    };
  } catch (error) {
    return {
      ok: false,
      reason: "failed",
      detail: `The ${to} adapter could not serialize this piece: ${(error as Error).message}`,
    };
  }
}

/** A character's linked lorebooks, so an adapter that embeds knowledge can re-embed it. */
async function resolveKnowledge(bridge: KitBridge, entity: KitEntity): Promise<KitEntity[]> {
  const refs = (entity as unknown as { body?: { knowledgeRefs?: unknown } }).body?.knowledgeRefs;
  const ids = Array.isArray(refs) ? refs.filter((ref): ref is string => typeof ref === "string") : [];
  const books = await Promise.all(ids.map((ref) => bridge.read("lorebook", ref)));
  return books.filter((book): book is KitEntity => book !== null);
}

/**
 * The RoleCall hook machine out of a stored piece's escrow, which is the only place it lives: it is
 * never lifted into the canonical body, so a caller reading the body alone finds nothing.
 */
function escrowedHookYaml(entity: KitEntity): unknown {
  const original = (entity as unknown as { original?: Record<string, { raw?: unknown }> }).original ?? {};
  for (const slot of Object.values(original)) {
    const raw = slot?.raw;
    if (raw && typeof raw === "object" && "macro_engine_yaml" in raw) {
      return (raw as { macro_engine_yaml?: unknown }).macro_engine_yaml;
    }
  }
  return undefined;
}
