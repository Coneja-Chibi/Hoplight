/**
 * Settings-section registry - the ONE seam for drop-in sections (a browser bundle cannot glob).
 * Adding a section = one file in this folder + one import line here; ordering comes from the
 * section itself; nothing else is edited anywhere.
 */
import type { SettingsSection } from "../section-contract";
import appearance from "./appearance";
import studio from "./studio";
import workbench from "./workbench";

const SECTIONS: SettingsSection[] = [appearance, studio, workbench];

export const settingsSections = (): SettingsSection[] => [...SECTIONS].sort((a, b) => a.order - b.order);
