/**
 * Target pack registry. Browser cannot glob; add pack = file + one import here.
 */
import type { CssTargetPack } from "./contract";
import universal from "./universal";
import chubCard from "./chub-card";
import risuBackdrop from "./risu-backdrop";
import janitorProfile from "./janitor-profile";

const PACKS: readonly CssTargetPack[] = [
  universal,
  chubCard,
  risuBackdrop,
  janitorProfile,
];

export function listTargetPacks(): readonly CssTargetPack[] {
  return [...PACKS].sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id));
}

export function targetPackById(id: string): CssTargetPack | undefined {
  return PACKS.find((p) => p.id === id);
}

export const registeredTargetPackIds = (): string[] => PACKS.map((p) => p.id);
