/** Resolve UI asset URLs across the installed server and static browser Studio. */
import { isBrowserStudio } from "../../browser-mode";

export { isBrowserStudio } from "../../browser-mode";

/** Resolve one generated browser asset against the app's document base (loopback or project Pages). */
export const assetUrl = (path: string): string => new URL(path.replace(/^\//, ""), document.baseURI).href;

/** Static Pages serves docs directly; installed Hoplight keeps its allowlisted docs asset route. */
export const docAssetUrl = (path: string): string =>
  isBrowserStudio() ? assetUrl(path) : `/api/docs/asset?path=${encodeURIComponent(path)}`;

/** Resolve a stored portrait through the tab runtime when present, otherwise through loopback HTTP. */
export function portraitUrl(kind: string, id: string): string {
  const pocket = globalThis.__HOPLIGHT_POCKET_PORTRAIT__?.(kind, id);
  return pocket ?? `/api/studio/portrait?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`;
}

declare global {
  var __HOPLIGHT_POCKET_PORTRAIT__: ((kind: string, id: string) => string | null) | undefined;
}
