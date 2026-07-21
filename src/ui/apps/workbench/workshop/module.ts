/**
 * Pure readers for the packaged Risu module sitting on original.risu.unmapped.
 * Workshop uses this so the UI never digs into path strings ad-hoc.
 */
import { listScriptEffects, type RisuModule } from "../../../../formats/risu";

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);

/** Opened module view written by the risu adapter (openRisumModule). */
export interface WorkshopModuleView {
  name?: string;
  description?: string;
  id?: string;
  regexCount: number;
  lorebookCount: number;
  triggerCount: number;
  module: RisuModule;
  scripts: Array<{
    kind: "triggerlua" | "cjs" | "triggercode";
    triggerIndex: number;
    effectIndex: number;
    codeLength: number;
  }>;
}

/** Read the opened module from original draft, or null if none. */
export function readWorkshopModule(original: unknown): WorkshopModuleView | null {
  if (!isRec(original)) return null;
  const risu = isRec(original.risu) ? original.risu : null;
  if (!risu) return null;
  const unmapped = isRec(risu.unmapped) ? risu.unmapped : null;
  if (!unmapped) return null;
  const mod = unmapped.module;
  if (!isRec(mod) || !isRec(mod.module)) return null;
  // Adapter stores OpenedRisumModule shape
  return mod as unknown as WorkshopModuleView;
}

/** First triggerlua body on the module, if any. */
export function moduleLuaCode(view: WorkshopModuleView | null): string {
  if (!view) return "";
  const scripts = listScriptEffects(view.module);
  const hit = scripts.find((s) => s.kind === "triggerlua");
  return hit?.code ?? "";
}

/** Write a triggerlua body back into the structured module (overlay effect.code). */
export function withModuleLuaCode(view: WorkshopModuleView, code: string): WorkshopModuleView {
  const scripts = listScriptEffects(view.module);
  const hit = scripts.find((s) => s.kind === "triggerlua");
  if (!hit) return view;
  const triggers = [...(view.module.trigger ?? [])];
  const trig = { ...triggers[hit.triggerIndex]! };
  const effects = [...(trig.effect ?? [])];
  const row = isRec(effects[hit.effectIndex]) ? { ...effects[hit.effectIndex] as Rec } : {};
  effects[hit.effectIndex] = { ...row, type: "triggerlua", code };
  trig.effect = effects;
  triggers[hit.triggerIndex] = trig;
  const module: RisuModule = { ...view.module, trigger: triggers };
  return {
    ...view,
    module,
    scripts: listScriptEffects(module).map((s) => ({
      kind: s.kind,
      triggerIndex: s.triggerIndex,
      effectIndex: s.effectIndex,
      codeLength: s.code.length,
    })),
  };
}
