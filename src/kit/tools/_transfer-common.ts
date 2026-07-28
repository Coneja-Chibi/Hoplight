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

type ConversionKit = {
  registry: typeof import("../../core").registry;
  emitBundle: typeof import("../../convert").emitBundle;
  buildSerializeReport: typeof import("../../core").buildSerializeReport;
  checkMacroTransfer: typeof import("../../core/preset/macros/transfer-check").checkMacroTransfer;
  profileForAdapter: typeof import("../../core/preset/macros/transfer-check").profileForAdapter;
  sourceProfileOf: typeof import("../../core/preset/macros/transfer-check").sourceProfileOf;
  translatePresetBody: typeof import("../../core/preset/macros/translate").translatePresetBody;
  readPresetStructure: typeof import("../../core/preset/macros/structure").readPresetStructure;
};

/** Pull the conversion graph in on first use, with every adapter registered for this runtime. */
export async function loadConversionKit(): Promise<ConversionKit> {
  const [core, convert, macros, translate, structure, formats] = await Promise.all([
    import("../../core"),
    import("../../convert"),
    import("../../core/preset/macros/transfer-check"),
    import("../../core/preset/macros/translate"),
    import("../../core/preset/macros/structure"),
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
  /** The dialects this crossing went between, when both were known. */
  dialect?: { from: string; to: string };
}

export type ConversionOutcome = ConversionRefusal | ConversionSuccess;

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
  const fromProfile = kit.sourceProfileOf(entity);
  const toProfile = kit.profileForAdapter(to);
  if (fromProfile && toProfile && fromProfile !== toProfile) {
    const result = kit.translatePresetBody(
      (entity as unknown as { body?: unknown }).body,
      fromProfile,
      toProfile,
    );
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

    return {
      ok: true,
      text,
      payload: text ?? `<${out.bytes?.byteLength ?? 0} bytes of ${out.suggestedExtension}>`,
      suggestedExtension: out.suggestedExtension,
      loss,
      ...(macros ? { macros } : {}),
      ...(translation ? { translation } : {}),
      ...(structure ? { structure } : {}),
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
