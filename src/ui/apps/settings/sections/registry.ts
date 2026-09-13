/**
 * Settings-section registry - the ONE seam for drop-in sections (a browser bundle cannot glob).
 * Adding a section = one file in this folder + one import line here; ordering comes from the
 * section itself; nothing else is edited anywhere.
 */
import type { SettingsSection } from "../section-contract";
import about from "./about";
import appearance from "./appearance";
import connections from "./connections";
import models from "./models";
import remoteAccess from "./remote-access";
import studio from "./studio";
import updates from "./updates";
import workbench from "./workbench";

const SECTIONS: SettingsSection[] = [appearance, models, connections, studio, workbench, remoteAccess, updates, about];

export const settingsSections = (): SettingsSection[] => [...SECTIONS].sort((a, b) => a.order - b.order);
