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

type ConversionKit = {
  registry: typeof import("../../core").registry;
  emitBundle: typeof import("../../convert").emitBundle;
  buildSerializeReport: typeof import("../../core").buildSerializeReport;
  checkPresetMacroTransfer: typeof import("../../core/preset/macros/transfer-check").checkPresetMacroTransfer;
  profileForPresetAdapter: typeof import("../../core/preset/macros/transfer-check").profileForPresetAdapter;
  sourceProfileOf: typeof import("../../core/preset/macros/transfer-check").sourceProfileOf;
  translatePresetBody: typeof import("../../core/preset/macros/translate").translatePresetBody;
};

/** Pull the conversion graph in on first use, with every adapter registered for this runtime. */
export async function loadConversionKit(): Promise<ConversionKit> {
  const [core, convert, macros, translate, formats] = await Promise.all([
    import("../../core"),
    import("../../convert"),
    import("../../core/preset/macros/transfer-check"),
    import("../../core/preset/macros/translate"),
    import("../../ensure-formats"),
  ]);
  await formats.ensureFormats();
  return {
    registry: core.registry,
    emitBundle: convert.emitBundle,
    buildSerializeReport: core.buildSerializeReport,
    checkPresetMacroTransfer: macros.checkPresetMacroTransfer,
    profileForPresetAdapter: macros.profileForPresetAdapter,
    sourceProfileOf: macros.sourceProfileOf,
    translatePresetBody: translate.translatePresetBody,
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
  let subject = entity;
  let translation: MacroChange[] | undefined;
  let dialect: { from: string; to: string } | undefined;
  if (kind === "preset") {
    const fromProfile = kit.sourceProfileOf(entity);
    const toProfile = kit.profileForPresetAdapter(to);
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
    return {
      ok: true,
      text,
      payload: text ?? `<${out.bytes?.byteLength ?? 0} bytes of ${out.suggestedExtension}>`,
      suggestedExtension: out.suggestedExtension,
      loss,
      // Report macro survival against what is ACTUALLY being emitted, not the untranslated original.
      ...(kind === "preset"
        ? { macros: kit.checkPresetMacroTransfer((subject as unknown as { body?: unknown }).body, to) }
        : {}),
      ...(translation ? { translation } : {}),
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
