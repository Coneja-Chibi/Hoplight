/**
 * useVariants - the portrait card's variant state. Given the base draft + its React setter, it tracks
 * the active variant, derives the DISPLAY body (base with the active variant merged in), and returns a
 * variant-aware setField: when a variant is active, edits write into that variant's overrides; on Base
 * they write the base directly. So the whole editor edits either the base or the selected variant with
 * NO change to how fields read (they read the derived `draft`) or write (they call `setField`). Save and
 * dirty stay on the BASE draft. See entities/character/variant.ts (applyVariant) + ./variants.ts.
 */
import { useState, type Dispatch, type SetStateAction } from "react";
import type { CharacterBody, CharacterVariant } from "../../../entities/character/schema";
import { applyVariant } from "../../../entities/character/variant";
import { writePath } from "./editor-core";
import { addVariant, removeVariant, setVariantField, setVariantLabel, setVariantMode, variantsOf } from "./variants";

type Body = Record<string, unknown>;
const asBody = (b: Body): CharacterBody => b as unknown as CharacterBody;
const asRec = (b: CharacterBody): Body => b as unknown as Body;

export interface VariantsApi {
  /** the body the editor DISPLAYS: base, or base with the active variant merged in */
  draft: Body;
  variants: CharacterVariant[];
  activeId: string | null;
  active: CharacterVariant | null;
  select(id: string | null): void;
  /** variant-aware field write: base, or the active variant's overrides */
  setField(path: string, value: unknown): void;
  add(): void;
  remove(id: string): void;
  rename(id: string, label: string): void;
  setMode(id: string, mirrorBase: boolean): void;
}

export function useVariants(baseDraft: Body, setBaseDraft: Dispatch<SetStateAction<Body>>): VariantsApi {
  const [activeId, setActiveId] = useState<string | null>(null);
  const variants = variantsOf(baseDraft);
  const active = activeId ? variants.find((v) => v.id === activeId) ?? null : null;
  const draft = active ? asRec(applyVariant(asBody(baseDraft), active)) : baseDraft;

  const setField = (path: string, value: unknown): void => {
    if (active) setBaseDraft((d) => asRec(setVariantField(asBody(d), active.id, path, value)));
    else setBaseDraft((d) => writePath(d, path, value));
  };

  const add = (): void => {
    const id = crypto.randomUUID();
    setBaseDraft((d) => asRec(addVariant(asBody(d), id, `Variant ${variantsOf(d).length + 1}`)));
    setActiveId(id);
  };
  const remove = (id: string): void => {
    setBaseDraft((d) => asRec(removeVariant(asBody(d), id)));
    if (activeId === id) setActiveId(null);
  };
  const rename = (id: string, label: string): void => setBaseDraft((d) => asRec(setVariantLabel(asBody(d), id, label)));
  const setMode = (id: string, mirrorBase: boolean): void => setBaseDraft((d) => asRec(setVariantMode(asBody(d), id, mirrorBase)));

  return { draft, variants, activeId, active, select: setActiveId, setField, add, remove, rename, setMode };
}
