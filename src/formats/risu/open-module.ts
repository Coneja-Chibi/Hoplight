/**
 * Open a .risum blob into a JSON-safe view for original.risu.unmapped.
 * Fail-closed: bad/undecodable modules return null (raw base64 still rides moduleRisum).
 * Script bodies stay data strings - never executed here.
 */
import { decodeRisum, listScriptEffects, type RisuModule } from "./rpack";

export interface OpenedRisumModule {
  name?: string;
  description?: string;
  id?: string;
  regexCount: number;
  lorebookCount: number;
  triggerCount: number;
  /** Full structured module (triggers/regex/lorebook/scripts as data). */
  module: RisuModule;
  scripts: Array<{
    kind: "triggerlua" | "cjs" | "triggercode";
    triggerIndex: number;
    effectIndex: number;
    codeLength: number;
  }>;
}

/** Decode module bytes; null if magic/JSON/table fails. */
export function openRisumModule(bytes: Uint8Array): OpenedRisumModule | null {
  try {
    const decoded = decodeRisum(bytes);
    const scripts = listScriptEffects(decoded.module).map((s) => ({
      kind: s.kind,
      triggerIndex: s.triggerIndex,
      effectIndex: s.effectIndex,
      codeLength: s.code.length,
    }));
    return {
      name: decoded.module.name,
      description: decoded.module.description,
      id: decoded.module.id,
      regexCount: decoded.module.regex?.length ?? 0,
      lorebookCount: decoded.module.lorebook?.length ?? 0,
      triggerCount: decoded.module.trigger?.length ?? 0,
      module: decoded.module,
      scripts,
    };
  } catch {
    return null;
  }
}
