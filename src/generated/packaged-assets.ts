/**
 * PLACEHOLDER - the real module is baked by scripts/build-desktop.ts at build time and restored to
 * this placeholder afterwards, so the repo never carries (or claims to carry) a real asset bake.
 * A committed bake goes stale the moment any UI file changes; null cannot lie. desktop.ts refuses
 * to start on null with instructions, instead of shipping yesterday's UI silently.
 */
import type { PackagedAssets } from "../ui/assets";
export const PACKAGED_ASSETS: PackagedAssets | null = null;
