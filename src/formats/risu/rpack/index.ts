/**
 * Public RPack/.risum API - decode a module blob to structured parts, encode back.
 * One concept per file under this folder; this is the folder default surface.
 *
 * Edited export verification: see RPACK_EDITED_EXPORT_VERIFIED. Until independent ciphertext/
 * plaintext fixtures prove the substitution table under real edits, encodeRisumSmart refuses a
 * changed module with a clear error rather than re-encoding through an unproven table.
 */
import {
  modulePlainToText,
  parseRisum,
  serializeRisum,
  textToModulePlain,
  type RisumParts,
} from "./container";
import {
  listScriptEffects,
  modulesStructurallyEqual,
  parseModuleJson,
  serializeModuleJson,
  type RisuModule,
} from "./module";

export type { RisumParts, RisuModule };
export {
  parseRisum,
  serializeRisum,
  modulePlainToText,
  textToModulePlain,
  parseModuleJson,
  serializeModuleJson,
  listScriptEffects,
  modulesStructurallyEqual,
};
export { rpackDecode, rpackEncode } from "./codec";

/**
 * Release gate for re-encoding an *edited* structured module through the RPack table.
 * false = safe-block mode: unedited modules still emit original bytes; a changed module throws.
 * Flip only when hermetic independent ciphertext/plaintext fixtures cover the exercised mappings
 * (see plans/008-prove-or-gate-rpack.md). Self-inverse tests alone are never parity evidence.
 */
export const RPACK_EDITED_EXPORT_VERIFIED = false as const;

/** Thrown when a structured module edit would re-RPack without independent table parity proof. */
export class RpackEditedExportBlockedError extends Error {
  readonly code = "RPACK_EDITED_EXPORT_BLOCKED" as const;
  constructor(message?: string) {
    super(
      message ??
        "risu: cannot export an edited module.risum - RPack re-encode is not independently verified " +
          "for edited payloads. Save the card without module edits, or export card.json-only content; " +
          "unedited modules still re-export byte-identically.",
    );
    this.name = "RpackEditedExportBlockedError";
  }
}

/** Fully decoded .risum: typed module + original plain main bytes (for byte-safe re-pack). */
export interface DecodedRisum {
  module: RisuModule;
  /** Original decoded main block bytes; re-encode with these when the module body was not edited. */
  modulePlain: Uint8Array;
  assets: Uint8Array[];
}

/** Decode .risum bytes -> structured module + assets. */
export function decodeRisum(bytes: Uint8Array): DecodedRisum {
  const parts = parseRisum(bytes);
  return {
    module: parseModuleJson(modulePlainToText(parts.modulePlain)),
    modulePlain: parts.modulePlain,
    assets: parts.assets,
  };
}

/**
 * Encode back to .risum.
 * - Default / `repackFromModule: false`: re-pack original modulePlain (byte-lossless when unedited).
 * - `repackFromModule: true`: re-stringify the structured module (Risu envelope) then RPack.
 *   Blocked when RPACK_EDITED_EXPORT_VERIFIED is false (safe-block mode).
 */
export function encodeRisum(
  input: DecodedRisum & { repackFromModule?: boolean },
): Uint8Array {
  if (input.repackFromModule === true && !RPACK_EDITED_EXPORT_VERIFIED) {
    throw new RpackEditedExportBlockedError();
  }
  const modulePlain = input.repackFromModule
    ? textToModulePlain(serializeModuleJson(input.module))
    : input.modulePlain;
  const parts: RisumParts = { modulePlain, assets: input.assets };
  return serializeRisum(parts);
}

/**
 * Re-pack a module after structured edits, keeping asset blocks from the original blob.
 * Always re-stringifies the module body (valid Risu envelope).
 * Blocked in safe-block mode (RPACK_EDITED_EXPORT_VERIFIED === false).
 */
export function encodeRisumEdited(originalBytes: Uint8Array, module: RisuModule): Uint8Array {
  const decoded = decodeRisum(originalBytes);
  return encodeRisum({ ...decoded, module, repackFromModule: true });
}

/**
 * Export helper: if `edited` matches the original decode, emit original bytes (byte-lossless);
 * otherwise re-pack from the edited structured module (assets preserved from original).
 * In safe-block mode a changed module throws RpackEditedExportBlockedError - never silently
 * returns the old blob after an edit.
 */
export function encodeRisumSmart(originalBytes: Uint8Array, edited: RisuModule): Uint8Array {
  const decoded = decodeRisum(originalBytes);
  if (modulesStructurallyEqual(decoded.module, edited)) return originalBytes;
  if (!RPACK_EDITED_EXPORT_VERIFIED) throw new RpackEditedExportBlockedError();
  return encodeRisum({ ...decoded, module: edited, repackFromModule: true });
}

export default {
  decodeRisum,
  encodeRisum,
  encodeRisumEdited,
  encodeRisumSmart,
  parseRisum,
  serializeRisum,
  parseModuleJson,
  serializeModuleJson,
  listScriptEffects,
  modulesStructurallyEqual,
  RPACK_EDITED_EXPORT_VERIFIED,
  RpackEditedExportBlockedError,
};
