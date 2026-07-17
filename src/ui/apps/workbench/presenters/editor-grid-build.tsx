/**
 * Build bento card helper, sealed/macro cards, and act module lists for the grid presenters.
 * Extracted from Editor.tsx (layout construction only).
 */
import type { JSX, ReactNode } from "react";
import { BentoCard } from "../../../components/bento-card";
import { macroInventory, type LensVerdict } from "../editor-core";
import { FIELD_MODULES, type FieldModule } from "../fields";
import { RICH_FIELD_KINDS } from "./editor-layout-data";

export function buildBcard(
  moduleById: Map<string, FieldModule>,
  lensHides: (m: FieldModule) => boolean,
  lensDims: (m: FieldModule) => boolean,
  controlFor: (m: FieldModule) => JSX.Element,
  styles: Readonly<Record<string, string>>,
): (title: string, ids: readonly string[]) => JSX.Element | null {
  return (title: string, ids: readonly string[]): JSX.Element | null => {
    const mods = ids
      .map((id) => moduleById.get(id))
      .filter((m): m is FieldModule => m !== undefined && !lensHides(m));
    if (mods.length === 0) return null;
    return (
      <BentoCard key={title} title={title}>
        {mods.map((m) => (
          <div key={m.id} className={`${styles.bfield}${lensDims(m) ? ` ${styles.dimlens}` : ""}`}>
            {!RICH_FIELD_KINDS.has(m.kind) && (
              <span className={styles.blabel}>
                {m.sheetLabel}
                {m.required && <span className={styles.qreq}> *</span>}
              </span>
            )}
            {controlFor(m)}
          </div>
        ))}
      </BentoCard>
    );
  };
}

export function buildMacroCard(
  draft: unknown,
  styles: Readonly<Record<string, string>>,
): JSX.Element {
  const macroCounts = macroInventory(draft);
  return (
    <BentoCard key="macros" title="Variables · Macro Inventory">
      {macroCounts.length === 0 ? (
        <div className={styles.blabel}>No macros detected yet</div>
      ) : (
        macroCounts.map(([name, n]) => (
          <div key={name} className={styles.mrow}>
            <span className={styles.mname}>{name}</span>
            <span className={styles.mcnt}>{`× ${n}`}</span>
          </div>
        ))
      )}
    </BentoCard>
  );
}

export function buildSealedCard(
  originalKeys: string[],
  platformLabel: (id: string) => string,
  styles: Readonly<Record<string, string>>,
): ReactNode {
  const originalFormats = originalKeys.filter((k) => k !== "vaud-studio" && k !== "vaud-json");
  if (originalFormats.length === 0) return null;
  return (
    <BentoCard key="sealed" title="Sealed Cargo">
      <div className={styles.sealed}>
        {`The original ${originalFormats.map((k) => platformLabel(k)).join(" and ")} card is kept here whole and re-emitted byte-for-byte when you export back to that format. Read-only.`}
      </div>
    </BentoCard>
  );
}

export function moduleByIdMap(): Map<string, FieldModule> {
  return new Map(FIELD_MODULES.map((m) => [m.id, m]));
}

export function actModulesOf(
  moduleById: Map<string, FieldModule>,
  ids: readonly string[],
): FieldModule[] {
  return ids.map((id) => moduleById.get(id)).filter((m): m is FieldModule => m !== undefined);
}

export type { LensVerdict };
